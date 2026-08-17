create function private.list_staff_issues(
  target_status text default null,
  target_category text default null,
  target_district text default null,
  target_risk_level smallint default null,
  target_recurrence_only boolean default false,
  target_sort text default 'latest',
  target_limit integer default 50,
  target_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform private.require_staff();
  if target_status is not null and target_status not in ('received', 'viewed', 'in_progress', 'on_hold', 'completed')
    or target_category is not null and target_category not in ('road_sidewalk', 'waste_pollution', 'park_facility')
    or target_district is not null and target_district not in ('taoyuan','zhongli','pingzhen','bade','yangmei','luzhu','dayuan','guishan','longtan','daxi','xinwu','guanyin','fuxing')
    or target_risk_level is not null and target_risk_level not between 1 and 5
    or target_sort not in ('latest', 'risk', 'recurrence')
    or target_limit not between 1 and 50 or target_offset < 0 then
    raise exception using errcode = '22023', message = 'Invalid staff issue list query';
  end if;

  with base as (
    select issue.*,
      coalesce(latest_override.to_level, assessment.risk_level) as effective_risk,
      spot.field_status::text as field_status,
      recurrence.recurrence_count,
      recurrence.recurrence_count >= 3 and recurrence.reporter_count >= 2 as urgent
    from public.issues as issue
    join private.issue_ai_assessments as assessment on assessment.issue_id = issue.id
    join private.issue_problem_spots as link on link.issue_id = issue.id
    join private.problem_spots as spot on spot.id = link.problem_spot_id
    left join lateral (
      select override.to_level from private.issue_risk_overrides as override
      where override.issue_id = issue.id
      order by override.created_at desc, override.id desc limit 1
    ) as latest_override on true
    left join lateral (
      select count(*)::integer as recurrence_count,
        count(distinct recurrence_issue.reporter_id)::integer as reporter_count
      from private.recurrence_candidates as candidate
      join public.issues as recurrence_issue on recurrence_issue.id = candidate.issue_id
      where candidate.candidate_problem_spot_id = spot.id
        and candidate.status = 'approved' and candidate.counts_for_urgency
        and candidate.decided_at >= now() - interval '90 days'
    ) as recurrence on true
    where (target_status is null or issue.status::text = target_status)
      and (target_category is null or issue.category::text = target_category)
      and (target_district is null or issue.district_id = target_district)
      and (target_risk_level is null or coalesce(latest_override.to_level, assessment.risk_level) = target_risk_level)
  ), filtered as (
    select * from base where not target_recurrence_only or recurrence_count > 0
  ), page as (
    select * from filtered
    order by
      case when target_sort = 'risk' then effective_risk end desc nulls last,
      case when target_sort = 'recurrence' then recurrence_count end desc,
      created_at desc,
      id desc
    limit target_limit offset target_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((select jsonb_agg(
      (to_jsonb(page) - 'reporter_id' - 'submission_key' - 'body' - 'reporter_count')
      order by
        case when target_sort = 'risk' then effective_risk end desc nulls last,
        case when target_sort = 'recurrence' then recurrence_count end desc,
        created_at desc,
        id desc
    ) from page), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function private.list_staff_issues(text,text,text,smallint,boolean,text,integer,integer)
from public, anon, authenticated, service_role;
grant execute on function private.list_staff_issues(text,text,text,smallint,boolean,text,integer,integer)
to authenticated;

create function public.list_staff_issues(
  target_status text default null,
  target_category text default null,
  target_district text default null,
  target_risk_level smallint default null,
  target_recurrence_only boolean default false,
  target_sort text default 'latest',
  target_limit integer default 50,
  target_offset integer default 0
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.list_staff_issues(target_status, target_category, target_district,
    target_risk_level, target_recurrence_only, target_sort, target_limit, target_offset);
$$;

revoke all on function public.list_staff_issues(text,text,text,smallint,boolean,text,integer,integer)
from public, anon, authenticated, service_role;
grant execute on function public.list_staff_issues(text,text,text,smallint,boolean,text,integer,integer)
to authenticated;

notify pgrst, 'reload schema';
