create table private.resolution_evidence (
  issue_id uuid primary key references public.issues(id) on delete cascade,
  object_path text not null unique,
  inspection_note text not null check (
    inspection_note = btrim(inspection_note) and char_length(inspection_note) between 10 and 1000
  ),
  changed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (object_path ~ '^resolution/[0-9a-f-]{36}/[0-9a-f]{64}\.jpg$')
);

alter table private.resolution_evidence enable row level security;
revoke all on private.resolution_evidence from public, anon, authenticated, service_role;

alter function private.issue_detail(uuid) rename to issue_detail_without_resolution;
revoke all on function private.issue_detail_without_resolution(uuid)
from public, anon, authenticated, service_role;

create function private.issue_detail(target_issue_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.issue_detail_without_resolution(target_issue_id) || jsonb_build_object(
    'resolutionEvidence', (
      select jsonb_build_object(
        'inspectionNote', evidence.inspection_note,
        'createdAt', evidence.created_at
      )
      from private.resolution_evidence as evidence
      where evidence.issue_id = target_issue_id
    )
  );
$$;

revoke all on function private.issue_detail(uuid)
from public, anon, authenticated, service_role;

create function private.record_resolution_evidence(
  target_issue_id uuid,
  target_object_path text,
  target_inspection_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_staff();
  current_issue public.issues%rowtype;
  existing_evidence private.resolution_evidence%rowtype;
  target_spot_id uuid;
  prior_field_status private.field_status;
  clean_note text := btrim(target_inspection_note);
  expected_prefix text := 'resolution/' || target_issue_id::text || '/';
begin
  if clean_note is null or char_length(clean_note) not between 10 and 1000
    or not starts_with(target_object_path, expected_prefix)
    or target_object_path !~ '/[0-9a-f]{64}\.jpg$' then
    raise exception using errcode = '22023', message = 'Resolution photo and inspection note are required';
  end if;

  select * into current_issue from public.issues where id = target_issue_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'Issue is unavailable';
  end if;
  if current_issue.status <> 'in_progress' then
    raise exception using errcode = '22023', message = 'Issue must be in progress for resolution evidence';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'issue-photos' and name = target_object_path
  ) then
    raise exception using errcode = '22023', message = 'Processed resolution photo is missing';
  end if;

  select * into existing_evidence
  from private.resolution_evidence where issue_id = target_issue_id;
  if found then
    if existing_evidence.object_path = target_object_path and existing_evidence.inspection_note = clean_note then
      return private.issue_detail(target_issue_id);
    end if;
    raise exception using errcode = '23505', message = 'Resolution evidence already recorded';
  end if;

  insert into private.resolution_evidence(issue_id, object_path, inspection_note, changed_by)
  values (target_issue_id, target_object_path, clean_note, actor_id);

  select link.problem_spot_id, spot.field_status
  into target_spot_id, prior_field_status
  from private.issue_problem_spots as link
  join private.problem_spots as spot on spot.id = link.problem_spot_id
  where link.issue_id = target_issue_id
  for update of spot;

  update private.problem_spots
  set field_status = 'resolved_confirmed', updated_at = now()
  where id = target_spot_id;
  insert into private.field_status_events(
    problem_spot_id, issue_id, from_status, to_status, reason, changed_by
  ) values (
    target_spot_id, target_issue_id, prior_field_status, 'resolved_confirmed', 'staff_evidence', actor_id
  );
  return private.issue_detail(target_issue_id);
end;
$$;

revoke all on function private.record_resolution_evidence(uuid,text,text)
from public, anon, authenticated, service_role;
grant execute on function private.record_resolution_evidence(uuid,text,text) to authenticated;

create function public.record_resolution_evidence(
  target_issue_id uuid,
  target_object_path text,
  target_inspection_note text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.record_resolution_evidence(target_issue_id, target_object_path, target_inspection_note); $$;

revoke all on function public.record_resolution_evidence(uuid,text,text)
from public, anon, authenticated, service_role;
grant execute on function public.record_resolution_evidence(uuid,text,text) to authenticated;

create function private.authorize_resolution_evidence_photo(target_issue_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  authorized_path text;
begin
  if not private.can_read_issue(target_issue_id, actor_id) then
    raise exception using errcode = '42501', message = 'Photo is unavailable';
  end if;
  select object_path into authorized_path
  from private.resolution_evidence where issue_id = target_issue_id;
  if not found then
    raise exception using errcode = '42501', message = 'Photo is unavailable';
  end if;
  return authorized_path;
end;
$$;

revoke all on function private.authorize_resolution_evidence_photo(uuid)
from public, anon, authenticated, service_role;
grant execute on function private.authorize_resolution_evidence_photo(uuid) to authenticated;

create function public.authorize_resolution_evidence_photo(target_issue_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$ select private.authorize_resolution_evidence_photo(target_issue_id); $$;

revoke all on function public.authorize_resolution_evidence_photo(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.authorize_resolution_evidence_photo(uuid) to authenticated;

notify pgrst, 'reload schema';
