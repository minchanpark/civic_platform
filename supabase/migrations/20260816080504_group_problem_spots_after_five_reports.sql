-- Group nearby reports without changing or deleting the source issues.
do $$
declare
  source_spot private.problem_spots%rowtype;
  target_spot_id uuid;
begin
  for source_spot in
    select * from private.problem_spots order by created_at, id
  loop
    select spot.id into target_spot_id
    from private.problem_spots as spot
    where spot.id <> source_spot.id
      and spot.category = source_spot.category
      and spot.district_id = source_spot.district_id
      and (spot.created_at, spot.id) < (source_spot.created_at, source_spot.id)
      and private.distance_meters(
        spot.latitude, spot.longitude, source_spot.latitude, source_spot.longitude
      ) <= 30
    order by private.distance_meters(
      spot.latitude, spot.longitude, source_spot.latitude, source_spot.longitude
    ), spot.created_at, spot.id
    limit 1;

    if target_spot_id is null then
      continue;
    end if;

    update private.problem_spots as target
    set field_status = case
          when source_spot.updated_at > target.updated_at then source_spot.field_status
          else target.field_status
        end,
        updated_at = greatest(target.updated_at, source_spot.updated_at)
    where target.id = target_spot_id;

    update private.issue_problem_spots
    set problem_spot_id = target_spot_id
    where problem_spot_id = source_spot.id;

    update private.recurrence_candidates
    set candidate_problem_spot_id = target_spot_id
    where candidate_problem_spot_id = source_spot.id;

    update private.field_status_events
    set problem_spot_id = target_spot_id
    where problem_spot_id = source_spot.id;

    delete from private.problem_spots where id = source_spot.id;
  end loop;
end;
$$;

update private.problem_spots as spot
set field_status = 'active', updated_at = now()
where exists (
  select 1
  from private.issue_problem_spots as link
  join public.issues as issue on issue.id = link.issue_id
  where link.problem_spot_id = spot.id and issue.status <> 'completed'
);

create or replace function private.initialize_issue_problem_spot()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_spot_id uuid;
  previous_field_status private.field_status;
begin
  -- ponytail: category-wide lock; split by spatial cells only if insert contention is measured.
  perform pg_advisory_xact_lock(hashtext('civicpin_problem_spot:' || new.category::text));

  select spot.id, spot.field_status
  into selected_spot_id, previous_field_status
  from private.problem_spots as spot
  where spot.category = new.category
    and spot.district_id = new.district_id
    and private.distance_meters(spot.latitude, spot.longitude, new.latitude, new.longitude) <= 30
  order by private.distance_meters(spot.latitude, spot.longitude, new.latitude, new.longitude),
    spot.created_at, spot.id
  limit 1
  for update;

  if selected_spot_id is null then
    insert into private.problem_spots(
      origin_issue_id, category, district_id, latitude, longitude
    ) values (
      new.id, new.category, new.district_id, new.latitude, new.longitude
    ) returning id into selected_spot_id;
  else
    update private.problem_spots
    set field_status = 'active', updated_at = now()
    where id = selected_spot_id;
  end if;

  insert into private.issue_problem_spots(issue_id, problem_spot_id)
  values (new.id, selected_spot_id);

  if exists (
    select 1
    from private.issue_problem_spots as link
    join public.issue_status_events as completed_event
      on completed_event.issue_id = link.issue_id and completed_event.to_status = 'completed'
    where link.problem_spot_id = selected_spot_id
      and link.issue_id <> new.id
      and completed_event.created_at >= now() - interval '90 days'
  ) then
    insert into private.recurrence_candidates(issue_id, candidate_problem_spot_id, reason)
    values (new.id, selected_spot_id, 'same_category_within_30m_completed_in_90d');
  end if;

  insert into private.field_status_events(
    problem_spot_id, issue_id, from_status, to_status, reason, changed_by
  ) values (
    selected_spot_id, new.id, previous_field_status, 'active', 'submitted', new.reporter_id
  );
  return new;
end;
$$;

drop function public.list_staff_issues(text,text,text,smallint,boolean,text,integer,integer);
drop function private.list_staff_issues(text,text,text,smallint,boolean,text,integer,integer);

create function private.list_staff_issues(
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
    or target_category is not null and target_category not in ('road_sidewalk','waste_pollution','park_facility')
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

revoke all on function private.list_staff_issues(text,text,text,smallint,boolean,text,integer,integer,boolean)
from public, anon, authenticated, service_role;
grant execute on function private.list_staff_issues(text,text,text,smallint,boolean,text,integer,integer,boolean)
to authenticated;

create function public.list_staff_issues(
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
language sql
security invoker
set search_path = ''
as $$
  select private.list_staff_issues(target_status,target_category,target_district,
    target_risk_level,target_recurrence_only,target_sort,target_limit,target_offset,target_problem_spot_only);
$$;

revoke all on function public.list_staff_issues(text,text,text,smallint,boolean,text,integer,integer,boolean)
from public, anon, authenticated, service_role;
grant execute on function public.list_staff_issues(text,text,text,smallint,boolean,text,integer,integer,boolean)
to authenticated;

drop function public.list_staff_issue_map(double precision,double precision,double precision,double precision,text,text,text,smallint,boolean);
drop function private.list_staff_issue_map(double precision,double precision,double precision,double precision,text,text,text,smallint,boolean);

create function private.list_staff_issue_map(
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
    or target_category is not null and target_category not in ('road_sidewalk','waste_pollution','park_facility')
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

revoke all on function private.list_staff_issue_map(double precision,double precision,double precision,double precision,text,text,text,smallint,boolean,boolean)
from public, anon, authenticated, service_role;
grant execute on function private.list_staff_issue_map(double precision,double precision,double precision,double precision,text,text,text,smallint,boolean,boolean)
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
  target_recurrence_only boolean default false,
  target_problem_spot_only boolean default false
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.list_staff_issue_map(target_south,target_west,target_north,target_east,
    target_status,target_category,target_district,target_risk_level,target_recurrence_only,target_problem_spot_only);
$$;

revoke all on function public.list_staff_issue_map(double precision,double precision,double precision,double precision,text,text,text,smallint,boolean,boolean)
from public, anon, authenticated, service_role;
grant execute on function public.list_staff_issue_map(double precision,double precision,double precision,double precision,text,text,text,smallint,boolean,boolean)
to authenticated;

alter function private.issue_detail(uuid) rename to issue_detail_without_problem_spot_counts;
revoke all on function private.issue_detail_without_problem_spot_counts(uuid)
from public, anon, authenticated, service_role;

create function private.issue_detail(target_issue_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with detail as (
    select private.issue_detail_without_problem_spot_counts(target_issue_id) as payload
  ), density as (
    select count(*)::integer as issue_count
    from private.issue_problem_spots as selected_link
    join private.issue_problem_spots as grouped_link
      on grouped_link.problem_spot_id = selected_link.problem_spot_id
    join public.issues as grouped_issue
      on grouped_issue.id = grouped_link.issue_id and grouped_issue.metric_valid
    where selected_link.issue_id = target_issue_id
  )
  select detail.payload || jsonb_build_object(
    'field', coalesce(detail.payload -> 'field', '{}'::jsonb) || jsonb_build_object(
      'issueCount', density.issue_count,
      'problemSpot', density.issue_count >= 5
    )
  )
  from detail cross join density;
$$;

revoke all on function private.issue_detail(uuid)
from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
