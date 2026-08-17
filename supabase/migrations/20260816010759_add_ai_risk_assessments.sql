create table private.issue_ai_assessments (
  issue_id uuid primary key references public.issues(id) on delete cascade,
  analysis_status text not null check (analysis_status in ('evaluated', 'evaluation_required')),
  risk_level smallint check (risk_level between 1 and 5),
  risk_reason_codes text[] not null default '{}',
  filter_reason_codes text[] not null default '{}',
  input_scope text[] not null,
  model text,
  model_version text,
  failure_code text check (failure_code in ('provider_unavailable', 'provider_error', 'timeout', 'invalid_output')),
  assessed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(input_scope) > 0 and input_scope <@ array['title', 'body', 'category']::text[]),
  check (risk_reason_codes <@ array[
    'immediate_life_risk', 'accident_risk', 'health_risk', 'spreading_pollution',
    'pedestrian_obstruction', 'repeated_contamination', 'service_disruption', 'cosmetic_only'
  ]::text[]),
  check (filter_reason_codes <@ array[
    'possible_personal_data', 'advertising_irrelevant', 'repetition', 'harmful_content'
  ]::text[]),
  check (
    (analysis_status = 'evaluated'
      and risk_level is not null
      and cardinality(risk_reason_codes) > 0
      and model = btrim(model) and char_length(model) between 1 and 100
      and model_version = btrim(model_version) and char_length(model_version) between 1 and 100
      and failure_code is null)
    or
    (analysis_status = 'evaluation_required'
      and risk_level is null and model is null and model_version is null and failure_code is not null)
  )
);

create table private.issue_risk_overrides (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  change_key uuid not null,
  from_level smallint check (from_level between 1 and 5),
  to_level smallint not null check (to_level between 1 and 5),
  reason text not null check (reason = btrim(reason) and char_length(reason) between 10 and 1000),
  changed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (issue_id, change_key)
);

create index issue_risk_overrides_issue_created_idx
  on private.issue_risk_overrides(issue_id, created_at desc, id desc);

alter table private.issue_ai_assessments enable row level security;
alter table private.issue_risk_overrides enable row level security;
revoke all on private.issue_ai_assessments from public, anon, authenticated, service_role;
revoke all on private.issue_risk_overrides from public, anon, authenticated, service_role;

create function private.initialize_issue_ai_assessment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.issue_ai_assessments(
    issue_id, analysis_status, input_scope, failure_code
  ) values (
    new.id, 'evaluation_required', array['title', 'body', 'category'], 'provider_unavailable'
  );
  return new;
end;
$$;

revoke all on function private.initialize_issue_ai_assessment()
from public, anon, authenticated, service_role;

create trigger initialize_issue_ai_assessment
after insert on public.issues
for each row execute function private.initialize_issue_ai_assessment();

insert into private.issue_ai_assessments(issue_id, analysis_status, input_scope, failure_code, assessed_at)
select id, 'evaluation_required', array['title', 'body', 'category'], 'provider_unavailable', created_at
from public.issues
on conflict (issue_id) do nothing;

create function private.record_issue_ai_assessment(
  target_issue_id uuid,
  target_risk_level smallint,
  target_risk_reason_codes text[],
  target_filter_reason_codes text[],
  target_input_scope text[],
  target_model text,
  target_model_version text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_assessment private.issue_ai_assessments%rowtype;
  clean_model text := btrim(target_model);
  clean_version text := btrim(target_model_version);
begin
  if target_risk_level is null or target_risk_level not between 1 and 5
    or coalesce(cardinality(target_risk_reason_codes), 0) = 0
    or not target_risk_reason_codes <@ array[
      'immediate_life_risk', 'accident_risk', 'health_risk', 'spreading_pollution',
      'pedestrian_obstruction', 'repeated_contamination', 'service_disruption', 'cosmetic_only'
    ]::text[]
    or target_filter_reason_codes is null
    or not target_filter_reason_codes <@ array[
      'possible_personal_data', 'advertising_irrelevant', 'repetition', 'harmful_content'
    ]::text[]
    or coalesce(cardinality(target_input_scope), 0) = 0
    or not target_input_scope <@ array['title', 'body', 'category']::text[]
    or clean_model is null or char_length(clean_model) not between 1 and 100
    or clean_version is null or char_length(clean_version) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Invalid AI assessment';
  end if;

  select * into current_assessment
  from private.issue_ai_assessments
  where issue_id = target_issue_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'Issue is unavailable';
  end if;

  if current_assessment.analysis_status = 'evaluated' then
    if current_assessment.risk_level = target_risk_level
      and current_assessment.risk_reason_codes = target_risk_reason_codes
      and current_assessment.filter_reason_codes = target_filter_reason_codes
      and current_assessment.input_scope = target_input_scope
      and current_assessment.model = clean_model
      and current_assessment.model_version = clean_version then
      return true;
    end if;
    raise exception using errcode = '23505', message = 'AI assessment already recorded';
  end if;

  update private.issue_ai_assessments
  set analysis_status = 'evaluated',
      risk_level = target_risk_level,
      risk_reason_codes = target_risk_reason_codes,
      filter_reason_codes = target_filter_reason_codes,
      input_scope = target_input_scope,
      model = clean_model,
      model_version = clean_version,
      failure_code = null,
      assessed_at = now(),
      updated_at = now()
  where issue_id = target_issue_id;
  return true;
end;
$$;

revoke all on function private.record_issue_ai_assessment(uuid,smallint,text[],text[],text[],text,text)
from public, anon, authenticated, service_role;
grant execute on function private.record_issue_ai_assessment(uuid,smallint,text[],text[],text[],text,text)
to service_role;

create function public.record_issue_ai_assessment(
  target_issue_id uuid,
  target_risk_level smallint,
  target_risk_reason_codes text[],
  target_filter_reason_codes text[],
  target_input_scope text[],
  target_model text,
  target_model_version text
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.record_issue_ai_assessment(
    target_issue_id, target_risk_level, target_risk_reason_codes,
    target_filter_reason_codes, target_input_scope, target_model, target_model_version
  );
$$;

revoke all on function public.record_issue_ai_assessment(uuid,smallint,text[],text[],text[],text,text)
from public, anon, authenticated, service_role;
grant execute on function public.record_issue_ai_assessment(uuid,smallint,text[],text[],text[],text,text)
to service_role;

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
          'id', override.id,
          'fromLevel', override.from_level,
          'toLevel', override.to_level,
          'reason', override.reason,
          'createdAt', override.created_at
        ) order by override.created_at, override.id)
        from private.issue_risk_overrides as override
        where override.issue_id = issue.id
      ), '[]'::jsonb)
    ),
    'recurrenceCandidate', (
      select jsonb_build_object('status', candidate.status, 'reason', candidate.reason)
      from private.recurrence_candidates as candidate
      where candidate.issue_id = issue.id
    ),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id,
        'fromStatus', event.from_status,
        'toStatus', event.to_status,
        'reason', event.reason,
        'holdReason', event.hold_reason,
        'nextCheckAt', event.next_check_at,
        'finalAnswer', event.final_answer,
        'createdAt', event.created_at
      ) order by event.created_at)
      from public.issue_status_events as event
      where event.issue_id = issue.id
    ), '[]'::jsonb)
  )
  from public.issues as issue
  join private.issue_contacts as contact on contact.issue_id = issue.id
  join private.issue_photos as photo on photo.issue_id = issue.id
  join private.issue_problem_spots as link on link.issue_id = issue.id
  join private.problem_spots as spot on spot.id = link.problem_spot_id
  join private.issue_ai_assessments as assessment on assessment.issue_id = issue.id
  left join lateral (
    select override.*
    from private.issue_risk_overrides as override
    where override.issue_id = issue.id
    order by override.created_at desc, override.id desc
    limit 1
  ) as latest_override on true
  where issue.id = target_issue_id;
$$;

create function private.override_issue_risk(
  target_issue_id uuid,
  target_risk_level smallint,
  target_reason text,
  target_change_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_staff();
  clean_reason text := btrim(target_reason);
  current_level smallint;
  existing_override private.issue_risk_overrides%rowtype;
begin
  if target_risk_level is null or target_risk_level not between 1 and 5 or target_change_key is null
    or clean_reason is null or char_length(clean_reason) not between 10 and 1000 then
    raise exception using errcode = '22023', message = 'Risk level and change reason are required';
  end if;

  perform 1 from public.issues where id = target_issue_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'Issue is unavailable';
  end if;

  select * into existing_override
  from private.issue_risk_overrides
  where issue_id = target_issue_id and change_key = target_change_key;
  if found then
    if existing_override.to_level = target_risk_level and existing_override.reason = clean_reason then
      return private.issue_detail(target_issue_id);
    end if;
    raise exception using errcode = '23505', message = 'Risk change key was already used';
  end if;

  select coalesce(latest.to_level, assessment.risk_level) into current_level
  from private.issue_ai_assessments as assessment
  left join lateral (
    select override.to_level
    from private.issue_risk_overrides as override
    where override.issue_id = assessment.issue_id
    order by override.created_at desc, override.id desc
    limit 1
  ) as latest on true
  where assessment.issue_id = target_issue_id;

  insert into private.issue_risk_overrides(
    issue_id, change_key, from_level, to_level, reason, changed_by
  ) values (
    target_issue_id, target_change_key, current_level, target_risk_level, clean_reason, actor_id
  );
  return private.issue_detail(target_issue_id);
end;
$$;

revoke all on function private.override_issue_risk(uuid,smallint,text,uuid)
from public, anon, authenticated, service_role;
grant execute on function private.override_issue_risk(uuid,smallint,text,uuid) to authenticated;

create function public.override_issue_risk(
  target_issue_id uuid,
  target_risk_level smallint,
  target_reason text,
  target_change_key uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.override_issue_risk(target_issue_id, target_risk_level, target_reason, target_change_key); $$;

revoke all on function public.override_issue_risk(uuid,smallint,text,uuid)
from public, anon, authenticated, service_role;
grant execute on function public.override_issue_risk(uuid,smallint,text,uuid) to authenticated;

notify pgrst, 'reload schema';
