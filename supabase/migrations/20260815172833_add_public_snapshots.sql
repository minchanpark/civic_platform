create table public.district_public_snapshots (
  district_id text primary key check (district_id in (
    'taoyuan', 'zhongli', 'pingzhen', 'bade', 'yangmei', 'daxi', 'luzhu',
    'dayuan', 'guishan', 'longtan', 'xinwu', 'guanyin', 'fuxing'
  )),
  period_start date not null,
  period_end date not null,
  ticket_count integer not null check (ticket_count >= 0),
  completed_count integer not null check (completed_count between 0 and ticket_count),
  administrative_completion_rate numeric(5, 1),
  field_spot_count integer not null check (field_spot_count >= 0),
  resolved_spot_count integer not null check (resolved_spot_count between 0 and field_spot_count),
  field_resolution_rate numeric(5, 1),
  category_counts jsonb not null,
  hotspots jsonb not null,
  generated_at timestamptz not null,
  check (period_end >= period_start),
  check (jsonb_typeof(category_counts) = 'object'),
  check (jsonb_typeof(hotspots) = 'array')
);

alter table public.district_public_snapshots enable row level security;
revoke all on public.district_public_snapshots from public, anon, authenticated, service_role;
grant select (
  district_id, period_start, period_end, ticket_count, completed_count,
  administrative_completion_rate, field_spot_count, resolved_spot_count,
  field_resolution_rate, category_counts, hotspots, generated_at
) on public.district_public_snapshots to anon, authenticated, service_role;

create policy district_public_snapshots_read
on public.district_public_snapshots for select
to anon, authenticated
using (true);

create function private.refresh_public_snapshots()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_time timestamptz := date_trunc('day', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
  start_time timestamptz := snapshot_time - interval '90 days';
  inserted_count integer;
begin
  delete from public.district_public_snapshots;

  insert into public.district_public_snapshots(
    district_id, period_start, period_end, ticket_count, completed_count,
    administrative_completion_rate, field_spot_count, resolved_spot_count,
    field_resolution_rate, category_counts, hotspots, generated_at
  )
  with districts(id) as (
    values
      ('taoyuan'), ('zhongli'), ('pingzhen'), ('bade'), ('yangmei'), ('daxi'),
      ('luzhu'), ('dayuan'), ('guishan'), ('longtan'), ('xinwu'), ('guanyin'), ('fuxing')
  )
  select
    district.id,
    (snapshot_time at time zone 'Asia/Taipei')::date - 90,
    (snapshot_time at time zone 'Asia/Taipei')::date - 1,
    ticket.total,
    ticket.completed,
    case when ticket.total >= 10
      then round(ticket.completed::numeric * 100 / ticket.total, 1)
    end,
    field.total,
    field.resolved,
    case when field.total >= 10
      then round(field.resolved::numeric * 100 / field.total, 1)
    end,
    category.counts,
    hotspot.items,
    snapshot_time
  from districts as district
  cross join lateral (
    select
      count(*)::integer as total,
      count(*) filter (where issue.status = 'completed')::integer as completed
    from public.issues as issue
    where issue.district_id = district.id
      and issue.created_at >= start_time
      and issue.created_at < snapshot_time
  ) as ticket
  cross join lateral (
    select
      count(*)::integer as total,
      count(*) filter (where spot.field_status = 'resolved_confirmed')::integer as resolved
    from private.problem_spots as spot
    where spot.district_id = district.id
      and exists (
        select 1 from private.field_status_events as event
        where event.problem_spot_id = spot.id
          and event.to_status in ('verification_pending', 'resolved_confirmed', 'recurrence_confirmed')
          and event.created_at >= start_time
          and event.created_at < snapshot_time
      )
  ) as field
  cross join lateral (
    select coalesce(jsonb_object_agg(grouped.category, grouped.total), '{}'::jsonb) as counts
    from (
      select issue.category::text as category, count(*)::integer as total
      from public.issues as issue
      where issue.district_id = district.id
        and issue.created_at >= start_time
        and issue.created_at < snapshot_time
      group by issue.category
    ) as grouped
  ) as category
  cross join lateral (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'category', published.category,
        'reportCount', published.report_count,
        'recurrenceCount', published.recurrence_count,
        'fieldStatus', published.field_status,
        'latitude', published.generalized_latitude,
        'longitude', published.generalized_longitude
      ) order by published.report_count desc
    ), '[]'::jsonb) as items
    from (
      select
        spot.id,
        spot.category::text as category,
        spot.field_status::text as field_status,
        count(distinct issue.id)::integer as report_count,
        (
          select count(*)::integer
          from private.recurrence_candidates as recurrence
          where recurrence.candidate_problem_spot_id = spot.id
            and recurrence.status = 'approved'
            and recurrence.decided_at >= start_time
            and recurrence.decided_at < snapshot_time
        ) as recurrence_count,
        (round((spot.latitude / 0.00075)::numeric) * 0.00075)::double precision as generalized_latitude,
        (round((spot.longitude / 0.00075)::numeric) * 0.00075)::double precision as generalized_longitude
      from private.problem_spots as spot
      join private.issue_problem_spots as link on link.problem_spot_id = spot.id
      join public.issues as issue on issue.id = link.issue_id
      where spot.district_id = district.id
        and issue.created_at >= start_time
        and issue.created_at < snapshot_time
      group by spot.id
      having count(distinct issue.id) >= 5 and count(distinct issue.reporter_id) >= 3
    ) as published
  ) as hotspot;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function private.refresh_public_snapshots()
from public, anon, authenticated, service_role;
grant execute on function private.refresh_public_snapshots() to service_role;

create function public.refresh_public_snapshots()
returns integer
language sql
security invoker
set search_path = ''
as $$ select private.refresh_public_snapshots(); $$;

revoke all on function public.refresh_public_snapshots()
from public, anon, authenticated, service_role;
grant execute on function public.refresh_public_snapshots() to service_role;

select private.refresh_public_snapshots();
notify pgrst, 'reload schema';
