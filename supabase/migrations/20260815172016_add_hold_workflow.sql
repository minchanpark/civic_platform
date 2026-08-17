alter table public.issue_status_events
  drop constraint issue_status_events_issue_id_to_status_key,
  drop constraint issue_status_events_reason_check,
  drop constraint issue_status_events_check,
  drop constraint issue_status_events_check1,
  add column hold_reason text,
  add column next_check_at timestamptz,
  add constraint issue_status_events_reason_check check (reason in (
    'submitted', 'opened', 'processing_started', 'put_on_hold', 'resumed', 'completed'
  )),
  add constraint issue_status_events_transition_check check (
    (from_status is null and to_status = 'received' and reason = 'submitted') or
    (from_status = 'received' and to_status = 'viewed' and reason = 'opened') or
    (from_status = 'viewed' and to_status = 'in_progress' and reason = 'processing_started') or
    (from_status in ('viewed', 'in_progress') and to_status = 'on_hold' and reason = 'put_on_hold') or
    (from_status = 'on_hold' and to_status = 'in_progress' and reason = 'resumed') or
    (from_status = 'in_progress' and to_status = 'completed' and reason = 'completed')
  ),
  add constraint issue_status_events_detail_check check (
    (
      to_status = 'completed'
      and final_answer = btrim(final_answer)
      and char_length(final_answer) between 10 and 2000
      and hold_reason is null
      and next_check_at is null
    ) or (
      to_status = 'on_hold'
      and final_answer is null
      and hold_reason = btrim(hold_reason)
      and char_length(hold_reason) between 10 and 1000
      and next_check_at > created_at
    ) or (
      to_status not in ('completed', 'on_hold')
      and final_answer is null
      and hold_reason is null
      and next_check_at is null
    )
  );

create unique index issue_status_events_single_status_idx
  on public.issue_status_events(issue_id, to_status)
  where to_status in ('received', 'viewed', 'completed');

grant select (hold_reason, next_check_at)
on public.issue_status_events to authenticated;

create or replace function private.issue_detail(target_issue_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'issue', to_jsonb(issue) - 'reporter_id' - 'submission_key',
    'contact', jsonb_build_object('email', contact.reporter_email),
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', event.id,
          'fromStatus', event.from_status,
          'toStatus', event.to_status,
          'reason', event.reason,
          'holdReason', event.hold_reason,
          'nextCheckAt', event.next_check_at,
          'finalAnswer', event.final_answer,
          'createdAt', event.created_at
        ) order by event.created_at
      )
      from public.issue_status_events as event
      where event.issue_id = issue.id
    ), '[]'::jsonb)
  )
  from public.issues as issue
  join private.issue_contacts as contact on contact.issue_id = issue.id
  join private.issue_photos as photo on photo.issue_id = issue.id
  where issue.id = target_issue_id;
$$;

create function private.hold_issue(
  target_issue_id uuid,
  target_reason text,
  target_next_check_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_staff();
  clean_reason text := btrim(target_reason);
  current_issue public.issues%rowtype;
  latest_event public.issue_status_events%rowtype;
begin
  if clean_reason is null or char_length(clean_reason) not between 10 and 1000
    or target_next_check_at is null or target_next_check_at <= now() then
    raise exception using errcode = '22023', message = 'Hold reason and future review time are required';
  end if;
  select * into current_issue from public.issues where id = target_issue_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'Issue is unavailable';
  end if;
  if current_issue.status = 'on_hold' then
    select * into latest_event from public.issue_status_events
    where issue_id = target_issue_id and to_status = 'on_hold'
    order by created_at desc limit 1;
    if latest_event.hold_reason is distinct from clean_reason
      or latest_event.next_check_at is distinct from target_next_check_at then
      raise exception using errcode = '23505', message = 'Issue is already on hold with different details';
    end if;
    return private.issue_detail(target_issue_id);
  end if;
  if current_issue.status not in ('viewed', 'in_progress') then
    raise exception using errcode = '22023', message = 'Issue must be viewed or in progress before hold';
  end if;
  update public.issues
  set status = 'on_hold', status_changed_at = now(), updated_at = now()
  where id = target_issue_id;
  insert into public.issue_status_events(
    issue_id, from_status, to_status, reason, changed_by, hold_reason, next_check_at
  ) values (
    target_issue_id, current_issue.status, 'on_hold', 'put_on_hold', actor_id,
    clean_reason, target_next_check_at
  );
  return private.issue_detail(target_issue_id);
end;
$$;

revoke all on function private.hold_issue(uuid, text, timestamptz)
from public, anon, authenticated, service_role;
grant execute on function private.hold_issue(uuid, text, timestamptz) to authenticated;

create function public.hold_issue(
  target_issue_id uuid,
  target_reason text,
  target_next_check_at timestamptz
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.hold_issue(target_issue_id, target_reason, target_next_check_at); $$;

revoke all on function public.hold_issue(uuid, text, timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.hold_issue(uuid, text, timestamptz) to authenticated;

create function private.resume_issue(target_issue_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_staff();
  current_issue public.issues%rowtype;
begin
  select * into current_issue from public.issues where id = target_issue_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'Issue is unavailable';
  end if;
  if current_issue.status = 'in_progress' then
    return private.issue_detail(target_issue_id);
  end if;
  if current_issue.status <> 'on_hold' then
    raise exception using errcode = '22023', message = 'Only a held issue can resume';
  end if;
  update public.issues
  set status = 'in_progress', status_changed_at = now(), updated_at = now()
  where id = target_issue_id;
  insert into public.issue_status_events(issue_id, from_status, to_status, reason, changed_by)
  values (target_issue_id, 'on_hold', 'in_progress', 'resumed', actor_id);
  return private.issue_detail(target_issue_id);
end;
$$;

revoke all on function private.resume_issue(uuid)
from public, anon, authenticated, service_role;
grant execute on function private.resume_issue(uuid) to authenticated;

create function public.resume_issue(target_issue_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.resume_issue(target_issue_id); $$;

revoke all on function public.resume_issue(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.resume_issue(uuid) to authenticated;

notify pgrst, 'reload schema';
