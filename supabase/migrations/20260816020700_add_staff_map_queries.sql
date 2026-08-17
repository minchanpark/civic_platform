create index issues_map_viewport_idx on public.issues(latitude, longitude);
create index issues_map_filters_idx on public.issues(district_id, category, status, created_at desc);

create function private.staff_issue_status_counts()
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
    'received', count(*) filter (where status = 'received'),
    'viewed', count(*) filter (where status = 'viewed'),
    'in_progress', count(*) filter (where status = 'in_progress'),
    'on_hold', count(*) filter (where status = 'on_hold'),
    'completed', count(*) filter (where status = 'completed')
  ) into result from public.issues;
  return result;
end;
$$;

revoke all on function private.staff_issue_status_counts()
from public, anon, authenticated, service_role;
grant execute on function private.staff_issue_status_counts() to authenticated;

create function public.staff_issue_status_counts()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.staff_issue_status_counts(); $$;

revoke all on function public.staff_issue_status_counts()
from public, anon, authenticated, service_role;
grant execute on function public.staff_issue_status_counts() to authenticated;

create function private.list_staff_issue_map(
  target_south double precision,
  target_west double precision,
  target_north double precision,
  target_east double precision,
  target_status text default null,
  target_category text default null,
  target_district text default null,
  target_risk_level smallint default null,
  target_recurrence_only boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  perform private.require_staff();
  if target_south is null or target_west is null or target_north is null or target_east is null
    or target_south >= target_north or target_west >= target_east
    or target_south < -90 or target_north > 90 or target_west < -180 or target_east > 180
    or target_status is not null and target_status not in ('received','viewed','in_progress','on_hold','completed')
    or target_category is not null and target_category not in ('road_sidewalk','waste_pollution','park_facility')
    or target_district is not null and target_district not in ('taoyuan','zhongli','pingzhen','bade','yangmei','luzhu','dayuan','guishan','longtan','daxi','xinwu','guanyin','fuxing')
    or target_risk_level is not null and target_risk_level not between 1 and 5 then
    raise exception using errcode = '22023', message = 'Invalid staff map query';
  end if;

  with filtered as (
    select issue.*,
      coalesce(latest_override.to_level, assessment.risk_level) as effective_risk,
      recurrence.recurrence_count,
      recurrence.recurrence_count >= 3 and recurrence.reporter_count >= 2 as urgent
    from public.issues as issue
    join private.issue_ai_assessments as assessment on assessment.issue_id = issue.id
    join private.issue_problem_spots as link on link.issue_id = issue.id
    left join lateral (
      select override.to_level from private.issue_risk_overrides as override
      where override.issue_id = issue.id order by override.created_at desc, override.id desc limit 1
    ) as latest_override on true
    left join lateral (
      select count(*)::integer as recurrence_count,
        count(distinct recurrence_issue.reporter_id)::integer as reporter_count
      from private.recurrence_candidates as candidate
      join public.issues as recurrence_issue on recurrence_issue.id = candidate.issue_id
      where candidate.candidate_problem_spot_id = link.problem_spot_id
        and candidate.status = 'approved' and candidate.counts_for_urgency
        and candidate.decided_at >= now() - interval '90 days'
    ) as recurrence on true
    where issue.latitude between target_south and target_north
      and issue.longitude between target_west and target_east
      and (target_status is null or issue.status::text = target_status)
      and (target_category is null or issue.category::text = target_category)
      and (target_district is null or issue.district_id = target_district)
      and (target_risk_level is null or coalesce(latest_override.to_level, assessment.risk_level) = target_risk_level)
      and (not target_recurrence_only or recurrence.recurrence_count > 0)
  ), page as (
    select * from filtered order by created_at desc, id desc limit 500
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'truncated', (select count(*) > 500 from filtered),
    'items', coalesce((select jsonb_agg(
      to_jsonb(page) - 'reporter_id' - 'submission_key' - 'body' - 'reporter_count'
      order by created_at desc, id desc
    ) from page), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function private.list_staff_issue_map(double precision,double precision,double precision,double precision,text,text,text,smallint,boolean)
from public, anon, authenticated, service_role;
grant execute on function private.list_staff_issue_map(double precision,double precision,double precision,double precision,text,text,text,smallint,boolean)
to authenticated;

create function public.list_staff_issue_map(
  target_south double precision,
  target_west double precision,
  target_north double precision,
  target_east double precision,
  target_status text default null,
  target_category text default null,
  target_district text default null,
  target_risk_level smallint default null,
  target_recurrence_only boolean default false
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.list_staff_issue_map(target_south,target_west,target_north,target_east,
    target_status,target_category,target_district,target_risk_level,target_recurrence_only);
$$;

revoke all on function public.list_staff_issue_map(double precision,double precision,double precision,double precision,text,text,text,smallint,boolean)
from public, anon, authenticated, service_role;
grant execute on function public.list_staff_issue_map(double precision,double precision,double precision,double precision,text,text,text,smallint,boolean)
to authenticated;

notify pgrst, 'reload schema';
