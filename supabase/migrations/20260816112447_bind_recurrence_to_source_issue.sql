alter table private.recurrence_capture_tokens
  add column source_issue_id uuid references public.issues(id) on delete restrict,
  add column source_distance_meters double precision check (source_distance_meters between 0 and 500),
  add constraint recurrence_capture_tokens_source_pair_check
    check ((source_issue_id is null) = (source_distance_meters is null));

create index recurrence_capture_tokens_source_idx
  on private.recurrence_capture_tokens(source_issue_id)
  where source_issue_id is not null;

drop function public.create_recurrence_capture_token(
  uuid,text,double precision,double precision,double precision,text
);
drop function private.create_recurrence_capture_token(
  uuid,text,double precision,double precision,double precision,text
);

create function private.create_recurrence_capture_token(
  target_user_id uuid,
  target_source_issue_id uuid,
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
  source_issue public.issues%rowtype;
  distance_to_source double precision;
begin
  if target_user_id is null or target_source_issue_id is null
    or target_token_hash !~ '^[0-9a-f]{64}$'
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

  select issue.* into source_issue
  from public.issues as issue
  join private.issue_problem_spots as link on link.issue_id = issue.id
  join private.problem_spots as spot on spot.id = link.problem_spot_id
  where issue.id = target_source_issue_id
    and issue.reporter_id = target_user_id
    and issue.status = 'completed'
    and spot.field_status <> 'resolved_confirmed';
  if not found then
    raise exception using errcode = '42501', message = 'Completed source issue is unavailable';
  end if;

  distance_to_source := private.distance_meters(
    target_latitude, target_longitude, source_issue.latitude, source_issue.longitude
  );
  if distance_to_source > 500 then
    raise exception using errcode = '22023', message = 'Current location is too far from the source issue';
  end if;

  if (select count(*) from private.recurrence_capture_tokens
      where user_id = target_user_id and created_at > now() - interval '15 minutes') >= 5
    or (select count(*) from private.recurrence_capture_tokens
      where ip_hash = target_ip_hash and created_at > now() - interval '15 minutes') >= 20 then
    raise exception using errcode = 'P0001', message = 'Recurrence capture rate limit exceeded';
  end if;

  insert into private.recurrence_capture_tokens(
    token_hash, user_id, source_issue_id, source_distance_meters,
    latitude, longitude, accuracy_meters, ip_hash, expires_at
  ) values (
    target_token_hash, target_user_id, target_source_issue_id, distance_to_source,
    target_latitude, target_longitude, target_accuracy_meters, target_ip_hash, token_expiry
  );
  return token_expiry;
end;
$$;

revoke all on function private.create_recurrence_capture_token(
  uuid,uuid,text,double precision,double precision,double precision,text
) from public, anon, authenticated, service_role;
grant execute on function private.create_recurrence_capture_token(
  uuid,uuid,text,double precision,double precision,double precision,text
) to service_role;

create function public.create_recurrence_capture_token(
  target_user_id uuid,
  target_source_issue_id uuid,
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
  target_user_id, target_source_issue_id, target_token_hash, target_latitude,
  target_longitude, target_accuracy_meters, target_ip_hash
); $$;

revoke all on function public.create_recurrence_capture_token(
  uuid,uuid,text,double precision,double precision,double precision,text
) from public, anon, authenticated, service_role;
grant execute on function public.create_recurrence_capture_token(
  uuid,uuid,text,double precision,double precision,double precision,text
) to service_role;

create or replace function private.submit_recurrence_issue(
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
  source_issue public.issues%rowtype;
  result jsonb;
  result_issue_id uuid;
  distance_to_source double precision;
begin
  if target_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid recurrence capture token';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_token_hash, 0));
  select * into capture
  from private.recurrence_capture_tokens
  where token_hash = target_token_hash
  for update;
  if not found or capture.user_id <> target_reporter_id or capture.source_issue_id is null then
    raise exception using errcode = '42501', message = 'Recurrence capture token is unavailable';
  end if;

  select * into source_issue
  from public.issues
  where id = capture.source_issue_id
    and reporter_id = target_reporter_id
    and status = 'completed';
  if not found then
    raise exception using errcode = '42501', message = 'Completed source issue is unavailable';
  end if;
  if target_category <> source_issue.category or target_district_id <> source_issue.district_id then
    raise exception using errcode = '22023', message = 'Recurrence details do not match the source issue';
  end if;
  if private.distance_meters(
    capture.latitude, capture.longitude, target_latitude, target_longitude
  ) > 10 then
    raise exception using errcode = '22023', message = 'Recurrence capture location changed';
  end if;

  if capture.consumed_issue_id is not null then
    if exists (
      select 1 from public.issues
      where id = capture.consumed_issue_id
        and reporter_id = target_reporter_id and submission_key = target_submission_key
    ) then
      result := private.submit_issue(
        target_reporter_id, target_submission_key, source_issue.category, source_issue.district_id,
        source_issue.latitude, source_issue.longitude, target_title, target_body, target_photo_path,
        target_photo_bytes, target_photo_width, target_photo_height
      );
      return result || jsonb_build_object('recurrenceEvidence', true);
    end if;
    raise exception using errcode = '23505', message = 'Recurrence capture token was already used';
  end if;

  if capture.expires_at <= now() then
    raise exception using errcode = '22023', message = 'Recurrence capture token expired';
  end if;
  if not exists (
    select 1
    from private.issue_problem_spots as link
    join private.problem_spots as spot on spot.id = link.problem_spot_id
    where link.issue_id = source_issue.id and spot.field_status <> 'resolved_confirmed'
  ) then
    raise exception using errcode = '42501', message = 'Completed source issue is unavailable';
  end if;
  distance_to_source := private.distance_meters(
    capture.latitude, capture.longitude, source_issue.latitude, source_issue.longitude
  );
  if distance_to_source > 500 then
    raise exception using errcode = '22023', message = 'Current location is too far from the source issue';
  end if;

  result := private.submit_issue(
    target_reporter_id, target_submission_key, source_issue.category, source_issue.district_id,
    source_issue.latitude, source_issue.longitude, target_title, target_body, target_photo_path,
    target_photo_bytes, target_photo_width, target_photo_height
  );
  result_issue_id := (result ->> 'id')::uuid;

  insert into private.recurrence_evidence(
    issue_id, token_hash, capture_started_at, latitude, longitude,
    accuracy_meters, pin_distance_meters
  ) values (
    result_issue_id, target_token_hash, capture.created_at, capture.latitude,
    capture.longitude, capture.accuracy_meters, distance_to_source
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
