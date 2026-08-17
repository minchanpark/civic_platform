create table private.system_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('public_snapshot')),
  status text not null check (status in ('succeeded', 'failed')),
  output_count integer,
  error_code text,
  created_at timestamptz not null default now()
);

create index system_job_runs_type_created_idx
  on private.system_job_runs(job_type, created_at desc);

alter table private.system_job_runs enable row level security;
revoke all on private.system_job_runs from public, anon, authenticated, service_role;

create function private.refresh_public_snapshots_if_due()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
  refreshed integer;
begin
  if (select max(generated_at) >= today_start from public.district_public_snapshots) then
    return jsonb_build_object('ran', false, 'success', true, 'count', 0);
  end if;
  begin
    refreshed := private.refresh_public_snapshots();
    insert into private.system_job_runs(job_type, status, output_count)
    values ('public_snapshot', 'succeeded', refreshed);
    return jsonb_build_object('ran', true, 'success', true, 'count', refreshed);
  exception when others then
    insert into private.system_job_runs(job_type, status, error_code)
    values ('public_snapshot', 'failed', sqlstate);
    return jsonb_build_object('ran', true, 'success', false, 'errorCode', sqlstate);
  end;
end;
$$;

revoke all on function private.refresh_public_snapshots_if_due()
from public, anon, authenticated, service_role;
grant execute on function private.refresh_public_snapshots_if_due() to service_role;

create function public.refresh_public_snapshots_if_due()
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.refresh_public_snapshots_if_due(); $$;

revoke all on function public.refresh_public_snapshots_if_due()
from public, anon, authenticated, service_role;
grant execute on function public.refresh_public_snapshots_if_due() to service_role;

create function private.list_orphaned_issue_photos(target_limit integer default 100)
returns table(object_path text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if target_limit is null or target_limit not between 1 and 500 then
    raise exception using errcode = '22023', message = 'Invalid orphan photo limit';
  end if;
  return query
  select object.name
  from storage.objects as object
  where object.bucket_id = 'issue-photos'
    and object.created_at < now() - interval '24 hours'
    and not exists (select 1 from private.issue_photos as photo where photo.object_path = object.name)
    and not exists (select 1 from private.resolution_evidence as evidence where evidence.object_path = object.name)
  order by object.created_at, object.name
  limit target_limit;
end;
$$;

revoke all on function private.list_orphaned_issue_photos(integer)
from public, anon, authenticated, service_role;
grant execute on function private.list_orphaned_issue_photos(integer) to service_role;

create function public.list_orphaned_issue_photos(target_limit integer default 100)
returns table(object_path text)
language sql
security invoker
set search_path = ''
as $$ select * from private.list_orphaned_issue_photos(target_limit); $$;

revoke all on function public.list_orphaned_issue_photos(integer)
from public, anon, authenticated, service_role;
grant execute on function public.list_orphaned_issue_photos(integer) to service_role;

notify pgrst, 'reload schema';
