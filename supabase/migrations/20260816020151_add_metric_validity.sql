alter table public.issues
  add column metric_valid boolean not null default true,
  add column metric_exclusion_reason text,
  add constraint issues_metric_validity_check check (
    (metric_valid and metric_exclusion_reason is null)
    or (not metric_valid and metric_exclusion_reason in ('cancelled', 'test', 'duplicate'))
  );

create table private.issue_metric_validity_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete restrict,
  from_valid boolean not null,
  to_valid boolean not null,
  reason text,
  changed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (from_valid <> to_valid),
  check ((to_valid and reason is null) or (not to_valid and reason in ('cancelled', 'test', 'duplicate')))
);

create index issue_metric_validity_events_issue_created_idx
  on private.issue_metric_validity_events(issue_id, created_at desc);
alter table private.issue_metric_validity_events enable row level security;
revoke all on private.issue_metric_validity_events from public, anon, authenticated, service_role;

create function private.set_issue_metric_validity(target_issue_id uuid, target_valid boolean, target_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_staff();
  current_issue public.issues%rowtype;
begin
  if target_valid is null or (target_valid and target_reason is not null)
    or (not target_valid and target_reason not in ('cancelled', 'test', 'duplicate')) then
    raise exception using errcode = '22023', message = 'Invalid metric validity reason';
  end if;
  select * into current_issue from public.issues where id = target_issue_id for update;
  if not found then raise exception using errcode = '42501', message = 'Issue is unavailable'; end if;
  if current_issue.metric_valid = target_valid then
    if current_issue.metric_exclusion_reason is distinct from target_reason then
      raise exception using errcode = '23505', message = 'Metric validity was already set with another reason';
    end if;
    return private.issue_detail(target_issue_id);
  end if;
  update public.issues set metric_valid = target_valid, metric_exclusion_reason = target_reason, updated_at = now()
  where id = target_issue_id;
  insert into private.issue_metric_validity_events(issue_id, from_valid, to_valid, reason, changed_by)
  values (target_issue_id, current_issue.metric_valid, target_valid, target_reason, actor_id);
  return private.issue_detail(target_issue_id);
end;
$$;

revoke all on function private.set_issue_metric_validity(uuid,boolean,text)
from public, anon, authenticated, service_role;
grant execute on function private.set_issue_metric_validity(uuid,boolean,text) to authenticated;

create function public.set_issue_metric_validity(target_issue_id uuid, target_valid boolean, target_reason text default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.set_issue_metric_validity(target_issue_id,target_valid,target_reason); $$;
revoke all on function public.set_issue_metric_validity(uuid,boolean,text)
from public, anon, authenticated, service_role;
grant execute on function public.set_issue_metric_validity(uuid,boolean,text) to authenticated;

create or replace function private.refresh_public_snapshots()
returns integer language plpgsql security definer set search_path = ''
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
  with districts(id) as (values
    ('taoyuan'),('zhongli'),('pingzhen'),('bade'),('yangmei'),('daxi'),('luzhu'),
    ('dayuan'),('guishan'),('longtan'),('xinwu'),('guanyin'),('fuxing')
  )
  select district.id, (snapshot_time at time zone 'Asia/Taipei')::date - 90,
    (snapshot_time at time zone 'Asia/Taipei')::date - 1, ticket.total, ticket.completed,
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
      and issue.created_at >= start_time and issue.created_at < snapshot_time
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
          and event.created_at >= start_time and event.created_at < snapshot_time
      )
  ) field
  cross join lateral (
    select coalesce(jsonb_object_agg(grouped.category,grouped.total),'{}'::jsonb) counts
    from (
      select issue.category::text category, count(*)::integer total
      from public.issues issue
      where issue.district_id = district.id and issue.metric_valid
        and issue.created_at >= start_time and issue.created_at < snapshot_time
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
            and recurrence.decided_at >= start_time and recurrence.decided_at < snapshot_time) recurrence_count,
        (round((spot.latitude/0.00075)::numeric)*0.00075)::double precision generalized_latitude,
        (round((spot.longitude/0.00075)::numeric)*0.00075)::double precision generalized_longitude
      from private.problem_spots spot
      join private.issue_problem_spots link on link.problem_spot_id = spot.id
      join public.issues issue on issue.id = link.issue_id
      where spot.district_id = district.id and issue.metric_valid
        and issue.created_at >= start_time and issue.created_at < snapshot_time
      group by spot.id
      having count(distinct issue.id) >= 5 and count(distinct issue.reporter_id) >= 3
    ) published
  ) hotspot;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

notify pgrst, 'reload schema';
