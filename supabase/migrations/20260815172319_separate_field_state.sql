create type private.field_status as enum (
  'active', 'verification_pending', 'resolved_confirmed', 'recurrence_confirmed'
);
create type private.recurrence_review_status as enum ('pending', 'approved', 'rejected');

create table private.problem_spots (
  id uuid primary key default gen_random_uuid(),
  origin_issue_id uuid not null unique references public.issues(id) on delete restrict,
  category public.issue_category not null,
  district_id text not null,
  latitude double precision not null,
  longitude double precision not null,
  field_status private.field_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index problem_spots_match_idx
  on private.problem_spots(category, updated_at desc, latitude, longitude);

create table private.issue_problem_spots (
  issue_id uuid primary key references public.issues(id) on delete cascade,
  problem_spot_id uuid not null references private.problem_spots(id) on delete restrict,
  linked_at timestamptz not null default now()
);

create index issue_problem_spots_spot_idx
  on private.issue_problem_spots(problem_spot_id, linked_at);

create table private.recurrence_candidates (
  issue_id uuid primary key references public.issues(id) on delete cascade,
  candidate_problem_spot_id uuid not null references private.problem_spots(id) on delete cascade,
  reason text not null check (reason = 'same_category_within_30m_completed_in_90d'),
  status private.recurrence_review_status not null default 'pending',
  decided_by uuid references auth.users(id) on delete restrict,
  decided_at timestamptz,
  counts_for_urgency boolean,
  created_at timestamptz not null default now(),
  check (
    (status = 'pending' and decided_by is null and decided_at is null and counts_for_urgency is null) or
    (status in ('approved', 'rejected') and decided_by is not null and decided_at is not null
      and counts_for_urgency is not null)
  )
);

create index recurrence_candidates_spot_review_idx
  on private.recurrence_candidates(candidate_problem_spot_id, status, decided_at desc);

create table private.field_status_events (
  id uuid primary key default gen_random_uuid(),
  problem_spot_id uuid not null references private.problem_spots(id) on delete cascade,
  issue_id uuid not null references public.issues(id) on delete restrict,
  from_status private.field_status,
  to_status private.field_status not null,
  reason text not null check (reason in (
    'submitted', 'backfilled', 'administrative_completion', 'staff_evidence', 'recurrence_approved'
  )),
  changed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index field_status_events_spot_created_idx
  on private.field_status_events(problem_spot_id, created_at);

alter table private.problem_spots enable row level security;
alter table private.issue_problem_spots enable row level security;
alter table private.recurrence_candidates enable row level security;
alter table private.field_status_events enable row level security;

revoke all on private.problem_spots from public, anon, authenticated, service_role;
revoke all on private.issue_problem_spots from public, anon, authenticated, service_role;
revoke all on private.recurrence_candidates from public, anon, authenticated, service_role;
revoke all on private.field_status_events from public, anon, authenticated, service_role;

create function private.distance_meters(
  latitude_a double precision,
  longitude_a double precision,
  latitude_b double precision,
  longitude_b double precision
)
returns double precision
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select 12742000 * asin(sqrt(
    power(sin(radians(latitude_b - latitude_a) / 2), 2)
    + cos(radians(latitude_a)) * cos(radians(latitude_b))
    * power(sin(radians(longitude_b - longitude_a) / 2), 2)
  ));
$$;

revoke all on function private.distance_meters(
  double precision, double precision, double precision, double precision
) from public, anon, authenticated, service_role;

create function private.initialize_issue_problem_spot()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_spot_id uuid;
  candidate_spot_id uuid;
begin
  insert into private.problem_spots(
    origin_issue_id, category, district_id, latitude, longitude
  ) values (
    new.id, new.category, new.district_id, new.latitude, new.longitude
  ) returning id into created_spot_id;

  insert into private.issue_problem_spots(issue_id, problem_spot_id)
  values (new.id, created_spot_id);

  select spot.id into candidate_spot_id
  from private.problem_spots as spot
  join private.issue_problem_spots as link on link.problem_spot_id = spot.id
  join public.issues as previous_issue on previous_issue.id = link.issue_id
  join public.issue_status_events as completed_event
    on completed_event.issue_id = previous_issue.id and completed_event.to_status = 'completed'
  where spot.id <> created_spot_id
    and spot.category = new.category
    and completed_event.created_at >= now() - interval '90 days'
    and private.distance_meters(spot.latitude, spot.longitude, new.latitude, new.longitude) <= 30
  order by private.distance_meters(spot.latitude, spot.longitude, new.latitude, new.longitude),
    completed_event.created_at desc
  limit 1;

  if candidate_spot_id is not null then
    insert into private.recurrence_candidates(issue_id, candidate_problem_spot_id, reason)
    values (new.id, candidate_spot_id, 'same_category_within_30m_completed_in_90d');
  end if;

  insert into private.field_status_events(
    problem_spot_id, issue_id, from_status, to_status, reason, changed_by
  ) values (created_spot_id, new.id, null, 'active', 'submitted', new.reporter_id);
  return new;
end;
$$;

revoke all on function private.initialize_issue_problem_spot()
from public, anon, authenticated, service_role;

create trigger initialize_issue_problem_spot
after insert on public.issues
for each row execute function private.initialize_issue_problem_spot();

with created as (
  insert into private.problem_spots(
    origin_issue_id, category, district_id, latitude, longitude, field_status, created_at, updated_at
  )
  select id, category, district_id, latitude, longitude,
    case when status = 'completed'
      then 'verification_pending'::private.field_status
      else 'active'::private.field_status
    end,
    created_at, updated_at
  from public.issues
  returning id, origin_issue_id, field_status
), linked as (
  insert into private.issue_problem_spots(issue_id, problem_spot_id)
  select origin_issue_id, id from created
)
insert into private.field_status_events(
  problem_spot_id, issue_id, from_status, to_status, reason, changed_by, created_at
)
select created.id, issue.id, null, created.field_status, 'backfilled', issue.reporter_id, issue.created_at
from created
join public.issues as issue on issue.id = created.origin_issue_id;

create or replace function private.issue_detail(target_issue_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'issue', to_jsonb(issue) - 'reporter_id' - 'submission_key',
    'contact', jsonb_build_object('email', contact.reporter_email),
    'field', jsonb_build_object(
      'status', spot.field_status,
      'recurrenceCount', (
        select count(*) from private.recurrence_candidates as counted
        where counted.candidate_problem_spot_id = spot.id
          and counted.status = 'approved' and counted.counts_for_urgency
          and counted.decided_at >= now() - interval '90 days'
      ),
      'urgent', (
        select count(*) >= 3 and count(distinct recurrence_issue.reporter_id) >= 2
        from private.recurrence_candidates as counted
        join public.issues as recurrence_issue on recurrence_issue.id = counted.issue_id
        where counted.candidate_problem_spot_id = spot.id
          and counted.status = 'approved' and counted.counts_for_urgency
          and counted.decided_at >= now() - interval '90 days'
      )
    ),
    'recurrenceCandidate', (
      select jsonb_build_object(
        'status', candidate.status,
        'reason', candidate.reason
      )
      from private.recurrence_candidates as candidate
      where candidate.issue_id = issue.id
    ),
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', event.id,
          'fromStatus', event.from_status,
          'toStatus', event.to_status,
          'reason', event.reason,
          'holdReason', event.hold_reason,
          'nextCheckAt', event.next_check_at,
          'finalAnswer', event.final_answer,
          'createdAt', event.created_at
        ) order by event.created_at
      )
      from public.issue_status_events as event
      where event.issue_id = issue.id
    ), '[]'::jsonb)
  )
  from public.issues as issue
  join private.issue_contacts as contact on contact.issue_id = issue.id
  join private.issue_photos as photo on photo.issue_id = issue.id
  join private.issue_problem_spots as link on link.issue_id = issue.id
  join private.problem_spots as spot on spot.id = link.problem_spot_id
  where issue.id = target_issue_id;
$$;

create or replace function private.complete_issue(target_issue_id uuid, target_final_answer text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_staff();
  clean_answer text := btrim(target_final_answer);
  current_issue public.issues%rowtype;
  completion_event_id uuid;
  stored_answer text;
  recipient text;
  target_spot_id uuid;
  previous_field_status private.field_status;
begin
  if clean_answer is null or char_length(clean_answer) not between 10 and 2000 then
    raise exception using errcode = '22023', message = 'Final answer must be 10 to 2000 characters';
  end if;
  select * into current_issue from public.issues where id = target_issue_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'Issue is unavailable';
  end if;
  if current_issue.status = 'completed' then
    select final_answer into stored_answer
    from public.issue_status_events
    where issue_id = target_issue_id and to_status = 'completed';
    if stored_answer is distinct from clean_answer then
      raise exception using errcode = '23505', message = 'Issue was already completed with a different answer';
    end if;
    return private.issue_detail(target_issue_id);
  end if;
  if current_issue.status <> 'in_progress' then
    raise exception using errcode = '22023', message = 'Issue must be in progress before completion';
  end if;

  update public.issues
  set status = 'completed', status_changed_at = now(), updated_at = now()
  where id = target_issue_id;

  insert into public.issue_status_events(
    issue_id, from_status, to_status, reason, changed_by, final_answer
  ) values (
    target_issue_id, 'in_progress', 'completed', 'completed', actor_id, clean_answer
  ) returning id into completion_event_id;

  select reporter_email into recipient from private.issue_contacts where issue_id = target_issue_id;
  insert into private.completion_email_outbox(
    issue_id, status_event_id, recipient_email, ticket_number
  ) values (
    target_issue_id, completion_event_id, recipient, current_issue.ticket_number
  );

  select spot.id, spot.field_status into target_spot_id, previous_field_status
  from private.issue_problem_spots as link
  join private.problem_spots as spot on spot.id = link.problem_spot_id
  where link.issue_id = target_issue_id
  for update of spot;

  update private.problem_spots
  set field_status = 'verification_pending', updated_at = now()
  where id = target_spot_id;

  insert into private.field_status_events(
    problem_spot_id, issue_id, from_status, to_status, reason, changed_by
  ) values (
    target_spot_id, target_issue_id, previous_field_status,
    'verification_pending', 'administrative_completion', actor_id
  );

  return private.issue_detail(target_issue_id);
end;
$$;

create function private.issue_field_status(target_issue_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  result_status text;
begin
  if not private.can_read_issue(target_issue_id, actor_id) then
    raise exception using errcode = '42501', message = 'Issue is unavailable';
  end if;
  select spot.field_status::text into result_status
  from private.issue_problem_spots as link
  join private.problem_spots as spot on spot.id = link.problem_spot_id
  where link.issue_id = target_issue_id;
  return result_status;
end;
$$;

revoke all on function private.issue_field_status(uuid)
from public, anon, authenticated, service_role;
grant execute on function private.issue_field_status(uuid) to authenticated;

create function public.issue_field_status(target_issue_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$ select private.issue_field_status(target_issue_id); $$;

revoke all on function public.issue_field_status(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.issue_field_status(uuid) to authenticated;

create function private.review_recurrence(target_issue_id uuid, target_approved boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_staff();
  candidate private.recurrence_candidates%rowtype;
  current_spot_id uuid;
  previous_field_status private.field_status;
  reporter uuid;
  should_count_for_urgency boolean;
begin
  if target_approved is null then
    raise exception using errcode = '22004', message = 'Recurrence decision is required';
  end if;
  select * into candidate from private.recurrence_candidates
  where issue_id = target_issue_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'Recurrence candidate is unavailable';
  end if;
  if candidate.status <> 'pending' then
    if (candidate.status = 'approved') is distinct from target_approved then
      raise exception using errcode = '23505', message = 'Recurrence already has a different decision';
    end if;
    return private.issue_detail(target_issue_id);
  end if;

  select reporter_id into reporter from public.issues where id = target_issue_id;
  should_count_for_urgency := target_approved and not exists (
    select 1
    from private.recurrence_candidates as prior
    join public.issues as prior_issue on prior_issue.id = prior.issue_id
    where prior.candidate_problem_spot_id = candidate.candidate_problem_spot_id
      and prior.status = 'approved'
      and prior_issue.reporter_id = reporter
      and prior.decided_at > now() - interval '24 hours'
  );

  update private.recurrence_candidates
  set status = case when target_approved
        then 'approved'::private.recurrence_review_status
        else 'rejected'::private.recurrence_review_status
      end,
      decided_by = actor_id,
      decided_at = now(),
      counts_for_urgency = should_count_for_urgency
  where issue_id = target_issue_id;

  if target_approved then
    select problem_spot_id into current_spot_id
    from private.issue_problem_spots where issue_id = target_issue_id for update;
    select field_status into previous_field_status
    from private.problem_spots where id = candidate.candidate_problem_spot_id for update;

    update private.issue_problem_spots
    set problem_spot_id = candidate.candidate_problem_spot_id, linked_at = now()
    where issue_id = target_issue_id;

    update private.problem_spots
    set field_status = 'recurrence_confirmed', updated_at = now()
    where id = candidate.candidate_problem_spot_id;

    insert into private.field_status_events(
      problem_spot_id, issue_id, from_status, to_status, reason, changed_by
    ) values (
      candidate.candidate_problem_spot_id, target_issue_id, previous_field_status,
      'recurrence_confirmed', 'recurrence_approved', actor_id
    );

    delete from private.problem_spots
    where id = current_spot_id
      and not exists (
        select 1 from private.issue_problem_spots where problem_spot_id = current_spot_id
      );
  end if;

  return private.issue_detail(target_issue_id);
end;
$$;

revoke all on function private.review_recurrence(uuid, boolean)
from public, anon, authenticated, service_role;
grant execute on function private.review_recurrence(uuid, boolean) to authenticated;

create function public.review_recurrence(target_issue_id uuid, target_approved boolean)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.review_recurrence(target_issue_id, target_approved); $$;

revoke all on function public.review_recurrence(uuid, boolean)
from public, anon, authenticated, service_role;
grant execute on function public.review_recurrence(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
