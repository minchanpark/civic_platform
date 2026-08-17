create table private.recurrence_capture_tokens (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between 24.589 and 25.124),
  longitude double precision not null check (longitude between 120.966 and 121.477),
  accuracy_meters double precision not null check (accuracy_meters between 0 and 500),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_issue_id uuid references public.issues(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((consumed_at is null and consumed_issue_id is null) or (consumed_at is not null and consumed_issue_id is not null))
);

create index recurrence_capture_tokens_user_created_idx
  on private.recurrence_capture_tokens(user_id, created_at desc);
create index recurrence_capture_tokens_ip_created_idx
  on private.recurrence_capture_tokens(ip_hash, created_at desc);

create table private.recurrence_evidence (
  issue_id uuid primary key references public.issues(id) on delete cascade,
  token_hash text not null unique references private.recurrence_capture_tokens(token_hash) on delete restrict,
  capture_started_at timestamptz not null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_meters double precision not null,
  pin_distance_meters double precision not null check (pin_distance_meters between 0 and 500),
  verified_at timestamptz not null default now()
);

alter table private.recurrence_capture_tokens enable row level security;
alter table private.recurrence_evidence enable row level security;
revoke all on private.recurrence_capture_tokens from public, anon, authenticated, service_role;
revoke all on private.recurrence_evidence from public, anon, authenticated, service_role;

alter table private.recurrence_candidates
  add column evidence_eligible boolean;
update private.recurrence_candidates set evidence_eligible = (status = 'approved');
alter table private.recurrence_candidates
  alter column evidence_eligible set default false,
  alter column evidence_eligible set not null,
  add constraint recurrence_candidates_approval_evidence_check
    check (status <> 'approved' or evidence_eligible);

create function private.require_recurrence_evidence_for_approval()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'approved' and not new.evidence_eligible then
    raise exception using errcode = '22023', message = 'Verified recurrence evidence is required';
  end if;
  return new;
end;
$$;

revoke all on function private.require_recurrence_evidence_for_approval()
from public, anon, authenticated, service_role;

create trigger require_recurrence_evidence_for_approval
before insert or update of status, evidence_eligible on private.recurrence_candidates
for each row execute function private.require_recurrence_evidence_for_approval();

create function private.create_recurrence_capture_token(
  target_user_id uuid,
  target_token_hash text,
  target_latitude double precision,
  target_longitude double precision,
  target_accuracy_meters double precision,
  target_ip_hash text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  token_expiry timestamptz := now() + interval '5 minutes';
begin
  if target_user_id is null or target_token_hash !~ '^[0-9a-f]{64}$'
    or target_ip_hash !~ '^[0-9a-f]{64}$'
    or target_latitude not between 24.589 and 25.124
    or target_longitude not between 120.966 and 121.477
    or target_accuracy_meters not between 0 and 500
    or not exists (
      select 1 from auth.users
      where id = target_user_id and email_confirmed_at is not null and not coalesce(is_anonymous, false)
    ) then
    raise exception using errcode = '22023', message = 'Invalid recurrence capture request';
  end if;

  if (select count(*) from private.recurrence_capture_tokens
      where user_id = target_user_id and created_at > now() - interval '15 minutes') >= 5
    or (select count(*) from private.recurrence_capture_tokens
      where ip_hash = target_ip_hash and created_at > now() - interval '15 minutes') >= 20 then
    raise exception using errcode = 'P0001', message = 'Recurrence capture rate limit exceeded';
  end if;

  insert into private.recurrence_capture_tokens(
    token_hash, user_id, latitude, longitude, accuracy_meters, ip_hash, expires_at
  ) values (
    target_token_hash, target_user_id, target_latitude, target_longitude,
    target_accuracy_meters, target_ip_hash, token_expiry
  );
  return token_expiry;
end;
$$;

revoke all on function private.create_recurrence_capture_token(uuid,text,double precision,double precision,double precision,text)
from public, anon, authenticated, service_role;
grant execute on function private.create_recurrence_capture_token(uuid,text,double precision,double precision,double precision,text)
to service_role;

create function public.create_recurrence_capture_token(
  target_user_id uuid,
  target_token_hash text,
  target_latitude double precision,
  target_longitude double precision,
  target_accuracy_meters double precision,
  target_ip_hash text
)
returns timestamptz
language sql
security invoker
set search_path = ''
as $$ select private.create_recurrence_capture_token(
  target_user_id, target_token_hash, target_latitude, target_longitude,
  target_accuracy_meters, target_ip_hash
); $$;

revoke all on function public.create_recurrence_capture_token(uuid,text,double precision,double precision,double precision,text)
from public, anon, authenticated, service_role;
grant execute on function public.create_recurrence_capture_token(uuid,text,double precision,double precision,double precision,text)
to service_role;

create function private.submit_recurrence_issue(
  target_reporter_id uuid,
  target_submission_key uuid,
  target_category public.issue_category,
  target_district_id text,
  target_latitude double precision,
  target_longitude double precision,
  target_title text,
  target_body text,
  target_photo_path text,
  target_photo_bytes integer,
  target_photo_width integer,
  target_photo_height integer,
  target_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  capture private.recurrence_capture_tokens%rowtype;
  result jsonb;
  result_issue_id uuid;
  distance_to_pin double precision;
begin
  if target_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid recurrence capture token';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_token_hash, 0));
  select * into capture
  from private.recurrence_capture_tokens
  where token_hash = target_token_hash
  for update;
  if not found or capture.user_id <> target_reporter_id then
    raise exception using errcode = '42501', message = 'Recurrence capture token is unavailable';
  end if;

  if capture.consumed_issue_id is not null then
    if exists (
      select 1 from public.issues
      where id = capture.consumed_issue_id
        and reporter_id = target_reporter_id and submission_key = target_submission_key
    ) then
      result := private.submit_issue(
        target_reporter_id, target_submission_key, target_category, target_district_id,
        target_latitude, target_longitude, target_title, target_body, target_photo_path,
        target_photo_bytes, target_photo_width, target_photo_height
      );
      return result || jsonb_build_object('recurrenceEvidence', true);
    end if;
    raise exception using errcode = '23505', message = 'Recurrence capture token was already used';
  end if;

  if capture.expires_at <= now() then
    raise exception using errcode = '22023', message = 'Recurrence capture token expired';
  end if;
  distance_to_pin := private.distance_meters(
    capture.latitude, capture.longitude, target_latitude, target_longitude
  );
  if distance_to_pin > 500 then
    raise exception using errcode = '22023', message = 'Current location is too far from the report PIN';
  end if;

  result := private.submit_issue(
    target_reporter_id, target_submission_key, target_category, target_district_id,
    target_latitude, target_longitude, target_title, target_body, target_photo_path,
    target_photo_bytes, target_photo_width, target_photo_height
  );
  result_issue_id := (result ->> 'id')::uuid;

  insert into private.recurrence_evidence(
    issue_id, token_hash, capture_started_at, latitude, longitude,
    accuracy_meters, pin_distance_meters
  ) values (
    result_issue_id, target_token_hash, capture.created_at, capture.latitude,
    capture.longitude, capture.accuracy_meters, distance_to_pin
  );
  update private.recurrence_capture_tokens
  set consumed_at = now(), consumed_issue_id = result_issue_id
  where token_hash = target_token_hash;
  update private.recurrence_candidates
  set evidence_eligible = true
  where issue_id = result_issue_id;
  return result || jsonb_build_object('recurrenceEvidence', true);
end;
$$;

revoke all on function private.submit_recurrence_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,text,text,text,integer,integer,integer,text
) from public, anon, authenticated, service_role;
grant execute on function private.submit_recurrence_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,text,text,text,integer,integer,integer,text
) to service_role;

create function public.submit_recurrence_issue(
  target_reporter_id uuid,
  target_submission_key uuid,
  target_category public.issue_category,
  target_district_id text,
  target_latitude double precision,
  target_longitude double precision,
  target_title text,
  target_body text,
  target_photo_path text,
  target_photo_bytes integer,
  target_photo_width integer,
  target_photo_height integer,
  target_token_hash text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.submit_recurrence_issue(
  target_reporter_id, target_submission_key, target_category, target_district_id,
  target_latitude, target_longitude, target_title, target_body, target_photo_path,
  target_photo_bytes, target_photo_width, target_photo_height, target_token_hash
); $$;

revoke all on function public.submit_recurrence_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,text,text,text,integer,integer,integer,text
) from public, anon, authenticated, service_role;
grant execute on function public.submit_recurrence_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,text,text,text,integer,integer,integer,text
) to service_role;

create or replace function private.issue_detail(target_issue_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'issue', to_jsonb(issue) - 'reporter_id' - 'submission_key',
    'contact', jsonb_build_object('email', contact.reporter_email),
    'field', jsonb_build_object(
      'status', spot.field_status,
      'recurrenceCount', (
        select count(*) from private.recurrence_candidates as counted
        where counted.candidate_problem_spot_id = spot.id
          and counted.status = 'approved' and counted.counts_for_urgency
          and counted.decided_at >= now() - interval '90 days'
      ),
      'urgent', (
        select count(*) >= 3 and count(distinct recurrence_issue.reporter_id) >= 2
        from private.recurrence_candidates as counted
        join public.issues as recurrence_issue on recurrence_issue.id = counted.issue_id
        where counted.candidate_problem_spot_id = spot.id
          and counted.status = 'approved' and counted.counts_for_urgency
          and counted.decided_at >= now() - interval '90 days'
      )
    ),
    'risk', jsonb_build_object(
      'assessmentStatus', assessment.analysis_status,
      'aiLevel', assessment.risk_level,
      'effectiveLevel', coalesce(latest_override.to_level, assessment.risk_level),
      'source', case when latest_override.id is not null then 'manager'
        when assessment.analysis_status = 'evaluated' then 'ai' else 'evaluation_required' end,
      'riskReasonCodes', assessment.risk_reason_codes,
      'filterReasonCodes', assessment.filter_reason_codes,
      'inputScope', assessment.input_scope,
      'model', assessment.model,
      'modelVersion', assessment.model_version,
      'assessedAt', assessment.assessed_at,
      'history', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', override.id, 'fromLevel', override.from_level, 'toLevel', override.to_level,
          'reason', override.reason, 'createdAt', override.created_at
        ) order by override.created_at, override.id)
        from private.issue_risk_overrides as override where override.issue_id = issue.id
      ), '[]'::jsonb)
    ),
    'recurrenceCandidate', (
      select jsonb_build_object(
        'status', candidate.status,
        'reason', candidate.reason,
        'evidenceEligible', candidate.evidence_eligible
      )
      from private.recurrence_candidates as candidate where candidate.issue_id = issue.id
    ),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id, 'fromStatus', event.from_status, 'toStatus', event.to_status,
        'reason', event.reason, 'holdReason', event.hold_reason,
        'nextCheckAt', event.next_check_at, 'finalAnswer', event.final_answer,
        'createdAt', event.created_at
      ) order by event.created_at)
      from public.issue_status_events as event where event.issue_id = issue.id
    ), '[]'::jsonb)
  )
  from public.issues as issue
  join private.issue_contacts as contact on contact.issue_id = issue.id
  join private.issue_photos as photo on photo.issue_id = issue.id
  join private.issue_problem_spots as link on link.issue_id = issue.id
  join private.problem_spots as spot on spot.id = link.problem_spot_id
  join private.issue_ai_assessments as assessment on assessment.issue_id = issue.id
  left join lateral (
    select override.* from private.issue_risk_overrides as override
    where override.issue_id = issue.id order by override.created_at desc, override.id desc limit 1
  ) as latest_override on true
  where issue.id = target_issue_id;
$$;

notify pgrst, 'reload schema';
