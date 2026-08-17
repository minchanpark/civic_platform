alter table private.completion_email_outbox
  add column email_type text not null default 'completed'
    check (email_type in ('completed', 'on_hold'));

create function private.enqueue_hold_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.to_status = 'on_hold' then
    insert into private.completion_email_outbox(
      issue_id, status_event_id, recipient_email, ticket_number, email_type
    )
    select new.issue_id, new.id, contact.reporter_email, issue.ticket_number, 'on_hold'
    from public.issues as issue
    join private.issue_contacts as contact on contact.issue_id = issue.id
    where issue.id = new.issue_id;
  end if;
  return new;
end;
$$;

revoke all on function private.enqueue_hold_email()
from public, anon, authenticated, service_role;

create trigger enqueue_hold_email
after insert on public.issue_status_events
for each row when (new.to_status = 'on_hold')
execute function private.enqueue_hold_email();

drop function public.claim_completion_emails(integer,uuid);
drop function private.claim_completion_emails(integer,uuid);

create function private.claim_completion_emails(target_limit integer, target_lock_token uuid)
returns table (
  id uuid, issue_id uuid, status_event_id uuid, recipient_email text,
  ticket_number text, email_type text, attempts integer, event_status text,
  event_at timestamptz, hold_reason text, next_check_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_limit is null or target_limit not between 1 and 50 or target_lock_token is null then
    raise exception using errcode = '22023', message = 'Invalid email claim';
  end if;
  return query
  with claimed as (
    select outbox.id, event.to_status::text as event_status, event.created_at as event_at,
      event.hold_reason, event.next_check_at
    from private.completion_email_outbox as outbox
    join public.issue_status_events as event on event.id = outbox.status_event_id
    where outbox.sent_at is null and outbox.next_attempt_at <= now()
      and (outbox.locked_at is null or outbox.locked_at < now() - interval '5 minutes')
    order by outbox.created_at, outbox.id
    for update of outbox skip locked
    limit target_limit
  )
  update private.completion_email_outbox as outbox
  set lock_token = target_lock_token, locked_at = now(), attempts = outbox.attempts + 1
  from claimed where outbox.id = claimed.id
  returning outbox.id, outbox.issue_id, outbox.status_event_id, outbox.recipient_email,
    outbox.ticket_number, outbox.email_type, outbox.attempts, claimed.event_status,
    claimed.event_at, claimed.hold_reason, claimed.next_check_at;
end;
$$;

revoke all on function private.claim_completion_emails(integer,uuid)
from public, anon, authenticated, service_role;
grant execute on function private.claim_completion_emails(integer,uuid) to service_role;

create function public.claim_completion_emails(target_limit integer, target_lock_token uuid)
returns table (
  id uuid, issue_id uuid, status_event_id uuid, recipient_email text,
  ticket_number text, email_type text, attempts integer, event_status text,
  event_at timestamptz, hold_reason text, next_check_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$ select * from private.claim_completion_emails(target_limit, target_lock_token); $$;

revoke all on function public.claim_completion_emails(integer,uuid)
from public, anon, authenticated, service_role;
grant execute on function public.claim_completion_emails(integer,uuid) to service_role;

create function private.notification_outbox_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  return (
    select jsonb_build_object(
      'pending', count(*) filter (where sent_at is null and last_error is null),
      'failed', count(*) filter (where sent_at is null and last_error is not null),
      'sent', count(*) filter (where sent_at is not null)
    ) from private.completion_email_outbox
  );
end;
$$;

revoke all on function private.notification_outbox_summary()
from public, anon, authenticated, service_role;
grant execute on function private.notification_outbox_summary() to authenticated;

create function public.notification_outbox_summary()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.notification_outbox_summary(); $$;

revoke all on function public.notification_outbox_summary()
from public, anon, authenticated, service_role;
grant execute on function public.notification_outbox_summary() to authenticated;

notify pgrst, 'reload schema';
