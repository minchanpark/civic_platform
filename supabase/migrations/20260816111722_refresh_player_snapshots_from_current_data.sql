create index if not exists issues_public_snapshot_idx
on public.issues(district_id, created_at)
where metric_valid;

create or replace function private.refresh_public_snapshots()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_time timestamptz := now();
  start_time timestamptz := snapshot_time - interval '90 days';
  inserted_count integer;
begin
  delete from public.district_public_snapshots;
  insert into public.district_public_snapshots(
    district_id, period_start, period_end, ticket_count, completed_count,
    administrative_completion_rate, field_spot_count, resolved_spot_count,
    field_resolution_rate, category_counts, hotspots, generated_at
  )
  with districts(id) as (values
    ('taoyuan'),('zhongli'),('pingzhen'),('bade'),('yangmei'),('daxi'),('luzhu'),
    ('dayuan'),('guishan'),('longtan'),('xinwu'),('guanyin'),('fuxing')
  )
  select district.id, (start_time at time zone 'Asia/Taipei')::date,
    (snapshot_time at time zone 'Asia/Taipei')::date, ticket.total, ticket.completed,
    case when ticket.total >= 10 then round(ticket.completed::numeric * 100 / ticket.total,1) end,
    field.total, field.resolved,
    case when field.total >= 10 then round(field.resolved::numeric * 100 / field.total,1) end,
    category.counts, hotspot.items, snapshot_time
  from districts as district
  cross join lateral (
    select count(*)::integer total,
      count(*) filter (where issue.status = 'completed')::integer completed
    from public.issues as issue
    where issue.district_id = district.id and issue.metric_valid
      and issue.created_at >= start_time and issue.created_at <= snapshot_time
  ) ticket
  cross join lateral (
    select count(*)::integer total,
      count(*) filter (where spot.field_status = 'resolved_confirmed')::integer resolved
    from private.problem_spots as spot
    where spot.district_id = district.id
      and exists (
        select 1 from private.issue_problem_spots link
        join public.issues issue on issue.id = link.issue_id
        where link.problem_spot_id = spot.id and issue.metric_valid
      )
      and exists (
        select 1 from private.field_status_events event
        where event.problem_spot_id = spot.id
          and event.to_status in ('verification_pending','resolved_confirmed','recurrence_confirmed')
          and event.created_at >= start_time and event.created_at <= snapshot_time
      )
  ) field
  cross join lateral (
    select coalesce(jsonb_object_agg(grouped.category,grouped.total),'{}'::jsonb) counts
    from (
      select issue.category::text category, count(*)::integer total
      from public.issues issue
      where issue.district_id = district.id and issue.metric_valid
        and issue.created_at >= start_time and issue.created_at <= snapshot_time
      group by issue.category
    ) grouped
  ) category
  cross join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'category',published.category,'reportCount',published.report_count,
      'recurrenceCount',published.recurrence_count,'fieldStatus',published.field_status,
      'latitude',published.generalized_latitude,'longitude',published.generalized_longitude
    ) order by published.report_count desc),'[]'::jsonb) items
    from (
      select spot.id, spot.category::text category, spot.field_status::text field_status,
        count(distinct issue.id)::integer report_count,
        (select count(*)::integer from private.recurrence_candidates recurrence
          join public.issues recurrence_issue on recurrence_issue.id = recurrence.issue_id
          where recurrence.candidate_problem_spot_id = spot.id and recurrence.status = 'approved'
            and recurrence_issue.metric_valid
            and recurrence.decided_at >= start_time and recurrence.decided_at <= snapshot_time) recurrence_count,
        (round((spot.latitude/0.00075)::numeric)*0.00075)::double precision generalized_latitude,
        (round((spot.longitude/0.00075)::numeric)*0.00075)::double precision generalized_longitude
      from private.problem_spots spot
      join private.issue_problem_spots link on link.problem_spot_id = spot.id
      join public.issues issue on issue.id = link.issue_id
      where spot.district_id = district.id and issue.metric_valid
        and issue.created_at >= start_time and issue.created_at <= snapshot_time
      group by spot.id
      having count(distinct issue.id) >= 5 and count(distinct issue.reporter_id) >= 3
    ) published
  ) hotspot;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function private.refresh_public_snapshots_if_due()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  refreshed integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('civicpin.public_snapshots', 0));
  if (select max(generated_at) >= now() - interval '5 minutes' from public.district_public_snapshots) then
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

select private.refresh_public_snapshots();
notify pgrst, 'reload schema';
