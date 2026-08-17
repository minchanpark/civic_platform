create table private.staff_issue_access_audit (
  id bigint generated always as identity primary key,
  issue_id uuid not null references public.issues(id) on delete restrict,
  staff_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action = 'detail_read'),
  created_at timestamptz not null default now()
);

create index staff_issue_access_audit_issue_created_idx
  on private.staff_issue_access_audit(issue_id, created_at desc);

alter table private.staff_issue_access_audit enable row level security;
revoke all on private.staff_issue_access_audit from public, anon, authenticated, service_role;

create or replace function private.acknowledge_issue(target_issue_id uuid)
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
  insert into private.staff_issue_access_audit(issue_id, staff_user_id, action)
  values (target_issue_id, actor_id, 'detail_read');
  if current_issue.status = 'received' then
    update public.issues set status = 'viewed', status_changed_at = now(), updated_at = now()
    where id = target_issue_id;
    insert into public.issue_status_events(issue_id, from_status, to_status, reason, changed_by)
    values (target_issue_id, 'received', 'viewed', 'opened', actor_id);
  end if;
  return private.issue_detail(target_issue_id);
end;
$$;

notify pgrst, 'reload schema';
