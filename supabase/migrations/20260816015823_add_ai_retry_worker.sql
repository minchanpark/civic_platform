alter table private.issue_ai_assessments
  add column retry_attempts integer not null default 0 check (retry_attempts between 0 and 8),
  add column next_attempt_at timestamptz default now(),
  add column lock_token uuid,
  add column locked_at timestamptz;

create index issue_ai_assessments_retry_idx
  on private.issue_ai_assessments(next_attempt_at, assessed_at)
  where analysis_status = 'evaluation_required' and next_attempt_at is not null;

create function private.claim_ai_assessment_retries(target_limit integer, target_lock_token uuid)
returns table(issue_id uuid, title text, body text, category text, attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_limit is null or target_limit not between 1 and 25 or target_lock_token is null then
    raise exception using errcode = '22023', message = 'Invalid AI retry claim';
  end if;
  return query
  with claimed as (
    select assessment.issue_id
    from private.issue_ai_assessments as assessment
    where assessment.analysis_status = 'evaluation_required'
      and assessment.next_attempt_at <= now()
      and assessment.retry_attempts < 8
      and (assessment.locked_at is null or assessment.locked_at < now() - interval '5 minutes')
    order by assessment.next_attempt_at, assessment.assessed_at, assessment.issue_id
    for update skip locked
    limit target_limit
  ), locked as (
    update private.issue_ai_assessments as assessment
    set lock_token = target_lock_token, locked_at = now(), retry_attempts = assessment.retry_attempts + 1
    from claimed where assessment.issue_id = claimed.issue_id
    returning assessment.issue_id, assessment.retry_attempts
  )
  select issue.id, issue.title, issue.body, issue.category::text, locked.retry_attempts
  from locked join public.issues as issue on issue.id = locked.issue_id;
end;
$$;

revoke all on function private.claim_ai_assessment_retries(integer,uuid)
from public, anon, authenticated, service_role;
grant execute on function private.claim_ai_assessment_retries(integer,uuid) to service_role;

create function public.claim_ai_assessment_retries(target_limit integer, target_lock_token uuid)
returns table(issue_id uuid, title text, body text, category text, attempts integer)
language sql
security invoker
set search_path = ''
as $$ select * from private.claim_ai_assessment_retries(target_limit, target_lock_token); $$;

revoke all on function public.claim_ai_assessment_retries(integer,uuid)
from public, anon, authenticated, service_role;
grant execute on function public.claim_ai_assessment_retries(integer,uuid) to service_role;

create function private.finish_ai_assessment_retry(
  target_issue_id uuid, target_lock_token uuid, target_success boolean,
  target_failure_code text default 'provider_error'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_issue_id is null or target_lock_token is null or target_success is null
    or target_failure_code not in ('provider_unavailable', 'provider_error', 'timeout', 'invalid_output') then
    raise exception using errcode = '22023', message = 'Invalid AI retry result';
  end if;
  if target_success then
    update private.issue_ai_assessments
    set lock_token = null, locked_at = null, next_attempt_at = null
    where issue_id = target_issue_id and lock_token = target_lock_token and analysis_status = 'evaluated';
  else
    update private.issue_ai_assessments
    set lock_token = null, locked_at = null, failure_code = target_failure_code,
      next_attempt_at = case when retry_attempts >= 8 then null
        else now() + make_interval(mins => least(60, 5 * retry_attempts)) end
    where issue_id = target_issue_id and lock_token = target_lock_token and analysis_status = 'evaluation_required';
  end if;
  return found;
end;
$$;

revoke all on function private.finish_ai_assessment_retry(uuid,uuid,boolean,text)
from public, anon, authenticated, service_role;
grant execute on function private.finish_ai_assessment_retry(uuid,uuid,boolean,text) to service_role;

create function public.finish_ai_assessment_retry(
  target_issue_id uuid, target_lock_token uuid, target_success boolean,
  target_failure_code text default 'provider_error'
)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.finish_ai_assessment_retry(target_issue_id, target_lock_token, target_success, target_failure_code); $$;

revoke all on function public.finish_ai_assessment_retry(uuid,uuid,boolean,text)
from public, anon, authenticated, service_role;
grant execute on function public.finish_ai_assessment_retry(uuid,uuid,boolean,text) to service_role;

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
  return result || jsonb_build_object('aiFailed', (
    select count(*) from private.issue_ai_assessments
    where analysis_status = 'evaluation_required' and retry_attempts >= 8 and next_attempt_at is null
  ));
end;
$$;

notify pgrst, 'reload schema';
