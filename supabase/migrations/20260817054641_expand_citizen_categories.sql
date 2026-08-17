-- Keep legacy categories readable while adding the Taiwan source-platform choices.
alter type public.issue_category add value if not exists 'public_utility';
alter type public.issue_category add value if not exists 'road_obstruction';
alter type public.issue_category add value if not exists 'streetlight_failure';
alter type public.issue_category add value if not exists 'abandoned_vehicle';
alter type public.issue_category add value if not exists 'bus_issue';

alter table public.issues
  drop constraint issues_supported_category_check,
  add constraint issues_supported_category_check check (category::text in (
    'public_utility', 'road_obstruction', 'streetlight_failure', 'abandoned_vehicle',
    'road_sidewalk', 'bus_issue', 'traffic_safety', 'other',
    'waste_pollution', 'park_facility'
  ));

create or replace function private.list_staff_issues(
  target_status text default null,
  target_category text default null,
  target_district text default null,
  target_risk_level smallint default null,
  target_recurrence_only boolean default false,
  target_sort text default 'latest',
  target_limit integer default 50,
  target_offset integer default 0,
  target_problem_spot_only boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  perform private.require_staff();
  if target_status is not null and target_status not in ('received','viewed','in_progress','on_hold','completed')
    or target_category is not null and target_category not in (
      'public_utility','road_obstruction','streetlight_failure','abandoned_vehicle',
      'road_sidewalk','bus_issue','traffic_safety','other','waste_pollution','park_facility'
    )
    or target_district is not null and target_district not in ('taoyuan','zhongli','pingzhen','bade','yangmei','luzhu','dayuan','guishan','longtan','daxi','xinwu','guanyin','fuxing')
    or target_risk_level is not null and target_risk_level not between 1 and 5
    or target_sort not in ('latest','risk','recurrence')
    or target_limit not between 1 and 50 or target_offset < 0 then
    raise exception using errcode = '22023', message = 'Invalid staff issue list query';
  end if;

  with base as (
    select issue.*,
      coalesce(latest_override.to_level, assessment.risk_level) as effective_risk,
      spot.field_status::text as field_status,
      recurrence.recurrence_count,
      recurrence.recurrence_count >= 3 and recurrence.reporter_count >= 2 as urgent,
      link.problem_spot_id,
      density.issue_count,
      density.issue_count >= 5 as problem_spot
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
    left join lateral (
      select count(*)::integer as issue_count
      from private.issue_problem_spots as grouped_link
      join public.issues as grouped_issue on grouped_issue.id = grouped_link.issue_id
      where grouped_link.problem_spot_id = spot.id and grouped_issue.metric_valid
    ) as density on true
    where (target_status is null or issue.status::text = target_status)
      and (target_category is null or issue.category::text = target_category)
      and (target_district is null or issue.district_id = target_district)
      and (target_risk_level is null or coalesce(latest_override.to_level, assessment.risk_level) = target_risk_level)
  ), filtered as (
    select * from base
    where (not target_recurrence_only or recurrence_count > 0)
      and (not target_problem_spot_only or problem_spot)
  ), page as (
    select * from filtered
    order by
      case when target_sort = 'risk' then effective_risk end desc nulls last,
      case when target_sort = 'recurrence' then recurrence_count end desc,
      created_at desc, id desc
    limit target_limit offset target_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((select jsonb_agg(
      to_jsonb(page) - 'reporter_id' - 'submission_key' - 'body' - 'reporter_count'
      order by
        case when target_sort = 'risk' then effective_risk end desc nulls last,
        case when target_sort = 'recurrence' then recurrence_count end desc,
        created_at desc, id desc
    ) from page), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function private.list_staff_issue_map(
  target_south double precision,
  target_west double precision,
  target_north double precision,
  target_east double precision,
  target_status text default null,
  target_category text default null,
  target_district text default null,
  target_risk_level smallint default null,
  target_recurrence_only boolean default false,
  target_problem_spot_only boolean default false
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
    or target_category is not null and target_category not in (
      'public_utility','road_obstruction','streetlight_failure','abandoned_vehicle',
      'road_sidewalk','bus_issue','traffic_safety','other','waste_pollution','park_facility'
    )
    or target_district is not null and target_district not in ('taoyuan','zhongli','pingzhen','bade','yangmei','luzhu','dayuan','guishan','longtan','daxi','xinwu','guanyin','fuxing')
    or target_risk_level is not null and target_risk_level not between 1 and 5 then
    raise exception using errcode = '22023', message = 'Invalid staff map query';
  end if;

  with filtered as (
    select issue.*,
      coalesce(latest_override.to_level, assessment.risk_level) as effective_risk,
      spot.field_status::text as field_status,
      recurrence.recurrence_count,
      recurrence.recurrence_count >= 3 and recurrence.reporter_count >= 2 as urgent,
      link.problem_spot_id,
      density.issue_count,
      density.issue_count >= 5 as problem_spot
    from public.issues as issue
    join private.issue_ai_assessments as assessment on assessment.issue_id = issue.id
    join private.issue_problem_spots as link on link.issue_id = issue.id
    join private.problem_spots as spot on spot.id = link.problem_spot_id
    left join lateral (
      select override.to_level from private.issue_risk_overrides as override
      where override.issue_id = issue.id order by override.created_at desc, override.id desc limit 1
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
    left join lateral (
      select count(*)::integer as issue_count
      from private.issue_problem_spots as grouped_link
      join public.issues as grouped_issue on grouped_issue.id = grouped_link.issue_id
      where grouped_link.problem_spot_id = spot.id and grouped_issue.metric_valid
    ) as density on true
    where issue.latitude between target_south and target_north
      and issue.longitude between target_west and target_east
      and (target_status is null or issue.status::text = target_status)
      and (target_category is null or issue.category::text = target_category)
      and (target_district is null or issue.district_id = target_district)
      and (target_risk_level is null or coalesce(latest_override.to_level, assessment.risk_level) = target_risk_level)
      and (not target_recurrence_only or recurrence.recurrence_count > 0)
      and (not target_problem_spot_only or density.issue_count >= 5)
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

notify pgrst, 'reload schema';
