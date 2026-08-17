create table private.issue_ai_assistance_jobs (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete restrict,
  request_key uuid not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','running','succeeded','failed')),
  attempts integer not null default 0 check (attempts between 0 and 8),
  next_attempt_at timestamptz default now(),
  lock_token uuid,
  locked_at timestamptz,
  summary text check (summary is null or char_length(summary) between 1 and 1000),
  answer_draft text check (answer_draft is null or char_length(answer_draft) between 1 and 4000),
  model text,
  model_version text,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issue_id, request_key),
  check ((status = 'succeeded') = (summary is not null and answer_draft is not null))
);

create index issue_ai_assistance_jobs_claim_idx
  on private.issue_ai_assistance_jobs(next_attempt_at, created_at)
  where status in ('pending','failed') and next_attempt_at is not null;

alter table private.issue_ai_assistance_jobs enable row level security;
revoke all on private.issue_ai_assistance_jobs from public, anon, authenticated, service_role;

alter table public.issue_status_events
  drop constraint issue_status_events_reason_check,
  drop constraint issue_status_events_transition_check,
  add constraint issue_status_events_reason_check check (reason in (
    'submitted', 'opened', 'processing_started', 'ai_assistance_queued', 'put_on_hold', 'resumed', 'completed'
  )),
  add constraint issue_status_events_transition_check check (
    (from_status is null and to_status = 'received' and reason = 'submitted') or
    (from_status = 'received' and to_status = 'viewed' and reason = 'opened') or
    (from_status = 'viewed' and to_status = 'in_progress' and reason in ('processing_started','ai_assistance_queued')) or
    (from_status in ('viewed', 'in_progress') and to_status = 'on_hold' and reason = 'put_on_hold') or
    (from_status = 'on_hold' and to_status = 'in_progress' and reason = 'resumed') or
    (from_status = 'in_progress' and to_status = 'completed' and reason = 'completed')
  );

alter function private.issue_detail(uuid) rename to issue_detail_without_ai_assistance;
revoke all on function private.issue_detail_without_ai_assistance(uuid)
from public, anon, authenticated, service_role;

create function private.issue_detail(target_issue_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.issue_detail_without_ai_assistance(target_issue_id) || jsonb_build_object(
    'aiAssistance', (
      select jsonb_build_object(
        'id', job.id, 'status', job.status, 'attempts', job.attempts,
        'summary', job.summary, 'answerDraft', job.answer_draft,
        'model', job.model, 'modelVersion', job.model_version,
        'failureCode', job.failure_code, 'createdAt', job.created_at, 'updatedAt', job.updated_at
      )
      from private.issue_ai_assistance_jobs as job
      where job.issue_id = target_issue_id
      order by job.created_at desc, job.id desc limit 1
    )
  );
$$;

revoke all on function private.issue_detail(uuid)
from public, anon, authenticated, service_role;

create function private.request_issue_ai_assistance(target_issue_id uuid, target_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_staff();
  current_issue public.issues%rowtype;
  target_job private.issue_ai_assistance_jobs%rowtype;
begin
  if target_request_key is null then
    raise exception using errcode = '22023', message = 'AI request key is required';
  end if;
  select * into current_issue from public.issues where id = target_issue_id for update;
  if not found then raise exception using errcode = '42501', message = 'Issue is unavailable'; end if;
  if current_issue.status not in ('viewed','in_progress') then
    raise exception using errcode = '22023', message = 'Issue must be viewed or in progress for AI assistance';
  end if;

  select * into target_job from private.issue_ai_assistance_jobs
  where issue_id = target_issue_id and request_key = target_request_key;
  if found then return to_jsonb(target_job) - 'requested_by' - 'lock_token'; end if;

  insert into private.issue_ai_assistance_jobs(issue_id, request_key, requested_by)
  values (target_issue_id, target_request_key, actor_id)
  returning * into target_job;

  if current_issue.status = 'viewed' then
    update public.issues set status = 'in_progress', status_changed_at = now(), updated_at = now()
    where id = target_issue_id;
    insert into public.issue_status_events(issue_id, from_status, to_status, reason, changed_by)
    values (target_issue_id, 'viewed', 'in_progress', 'ai_assistance_queued', actor_id);
  end if;
  return to_jsonb(target_job) - 'requested_by' - 'lock_token';
end;
$$;

revoke all on function private.request_issue_ai_assistance(uuid,uuid)
from public, anon, authenticated, service_role;
grant execute on function private.request_issue_ai_assistance(uuid,uuid) to authenticated;

create function public.request_issue_ai_assistance(target_issue_id uuid, target_request_key uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.request_issue_ai_assistance(target_issue_id,target_request_key); $$;

revoke all on function public.request_issue_ai_assistance(uuid,uuid)
from public, anon, authenticated, service_role;
grant execute on function public.request_issue_ai_assistance(uuid,uuid) to authenticated;

create function private.claim_ai_assistance_jobs(target_limit integer, target_lock_token uuid)
returns table(job_id uuid, issue_id uuid, title text, body text, category text, attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_limit is null or target_limit not between 1 and 10 or target_lock_token is null then
    raise exception using errcode = '22023', message = 'Invalid AI assistance claim';
  end if;
  return query
  with claimed as (
    select job.id from private.issue_ai_assistance_jobs as job
    where job.status in ('pending','failed') and job.next_attempt_at <= now() and job.attempts < 8
      and (job.locked_at is null or job.locked_at < now() - interval '5 minutes')
    order by job.next_attempt_at, job.created_at, job.id
    for update skip locked limit target_limit
  ), locked as (
    update private.issue_ai_assistance_jobs as job
    set status = 'running', attempts = job.attempts + 1,
      lock_token = target_lock_token, locked_at = now(), updated_at = now()
    from claimed where job.id = claimed.id
    returning job.id, job.issue_id, job.attempts
  )
  select locked.id, issue.id, issue.title, issue.body, issue.category::text, locked.attempts
  from locked join public.issues as issue on issue.id = locked.issue_id;
end;
$$;

revoke all on function private.claim_ai_assistance_jobs(integer,uuid)
from public, anon, authenticated, service_role;
grant execute on function private.claim_ai_assistance_jobs(integer,uuid) to service_role;

create function public.claim_ai_assistance_jobs(target_limit integer, target_lock_token uuid)
returns table(job_id uuid, issue_id uuid, title text, body text, category text, attempts integer)
language sql
security invoker
set search_path = ''
as $$ select * from private.claim_ai_assistance_jobs(target_limit,target_lock_token); $$;

revoke all on function public.claim_ai_assistance_jobs(integer,uuid)
from public, anon, authenticated, service_role;
grant execute on function public.claim_ai_assistance_jobs(integer,uuid) to service_role;

create function private.finish_ai_assistance_job(
  target_job_id uuid, target_lock_token uuid, target_success boolean,
  target_summary text default null, target_answer_draft text default null,
  target_model text default null, target_model_version text default null,
  target_failure_code text default 'provider_error'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_job_id is null or target_lock_token is null or target_success is null
    or (target_success and (target_summary is null or target_answer_draft is null
      or char_length(btrim(target_summary)) not between 1 and 1000
      or char_length(btrim(target_answer_draft)) not between 1 and 4000
      or nullif(btrim(target_model),'') is null or nullif(btrim(target_model_version),'') is null))
    or (not target_success and target_failure_code not in ('provider_unavailable','provider_error','timeout','invalid_output')) then
    raise exception using errcode = '22023', message = 'Invalid AI assistance result';
  end if;

  update private.issue_ai_assistance_jobs as job set
    status = case when target_success then 'succeeded' else 'failed' end,
    summary = case when target_success then btrim(target_summary) end,
    answer_draft = case when target_success then btrim(target_answer_draft) end,
    model = case when target_success then btrim(target_model) end,
    model_version = case when target_success then btrim(target_model_version) end,
    failure_code = case when target_success then null else target_failure_code end,
    next_attempt_at = case when target_success or job.attempts >= 8 then null
      else now() + make_interval(mins => least(60, 5 * job.attempts)) end,
    lock_token = null, locked_at = null, updated_at = now()
  where job.id = target_job_id and job.lock_token = target_lock_token and job.status = 'running';
  return found;
end;
$$;

revoke all on function private.finish_ai_assistance_job(uuid,uuid,boolean,text,text,text,text,text)
from public, anon, authenticated, service_role;
grant execute on function private.finish_ai_assistance_job(uuid,uuid,boolean,text,text,text,text,text) to service_role;

create function public.finish_ai_assistance_job(
  target_job_id uuid, target_lock_token uuid, target_success boolean,
  target_summary text default null, target_answer_draft text default null,
  target_model text default null, target_model_version text default null,
  target_failure_code text default 'provider_error'
)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.finish_ai_assistance_job(target_job_id,target_lock_token,target_success,
  target_summary,target_answer_draft,target_model,target_model_version,target_failure_code); $$;

revoke all on function public.finish_ai_assistance_job(uuid,uuid,boolean,text,text,text,text,text)
from public, anon, authenticated, service_role;
grant execute on function public.finish_ai_assistance_job(uuid,uuid,boolean,text,text,text,text,text) to service_role;

create or replace function private.notification_outbox_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  perform private.require_staff();
  select jsonb_build_object(
    'pending', count(*) filter (where sent_at is null and last_error is null),
    'failed', count(*) filter (where sent_at is null and last_error is not null),
    'sent', count(*) filter (where sent_at is not null)
  ) into result from private.completion_email_outbox;
  return result || jsonb_build_object(
    'aiFailed', (select count(*) from private.issue_ai_assessments
      where analysis_status = 'evaluation_required' and retry_attempts >= 8 and next_attempt_at is null),
    'aiAssistFailed', (select count(*) from private.issue_ai_assistance_jobs
      where status = 'failed' and attempts >= 8 and next_attempt_at is null)
  );
end;
$$;

notify pgrst, 'reload schema';
