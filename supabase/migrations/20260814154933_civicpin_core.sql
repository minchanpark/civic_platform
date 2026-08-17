begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

alter default privileges in schema public revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges in schema private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated, service_role;

create type public.issue_category as enum (
  'road_damage',
  'public_facility',
  'traffic_safety',
  'waste_environment',
  'other'
);

create type public.issue_status as enum ('received', 'viewed', 'in_progress', 'completed');
create type public.issue_visibility as enum ('private', 'pending_publication', 'public');

create sequence private.civic_ticket_number_seq;
revoke all on sequence private.civic_ticket_number_seq from public, anon, authenticated, service_role;

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  reporter_id uuid not null references auth.users(id) on delete restrict,
  submission_key uuid not null,
  category public.issue_category not null,
  district_id text not null check (district_id = 'taoyuan'),
  latitude double precision not null check (latitude between 24.80 and 25.15),
  longitude double precision not null check (longitude between 120.95 and 121.50),
  title text not null check (title = btrim(title) and char_length(title) between 5 and 80),
  body text not null check (body = btrim(body) and char_length(body) between 10 and 2000),
  status public.issue_status not null default 'received',
  visibility public.issue_visibility not null default 'private',
  assigned_department text check (
    assigned_department is null or assigned_department in (
      'road_maintenance',
      'public_facilities',
      'traffic_safety',
      'environmental_services',
      'general_services'
    )
  ),
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reporter_id, submission_key)
);

create index issues_reporter_created_idx on public.issues(reporter_id, created_at desc);
create index issues_status_created_idx on public.issues(status, created_at desc);

create table public.issue_status_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  from_status public.issue_status,
  to_status public.issue_status not null,
  reason text not null check (reason in ('submitted', 'opened', 'processing_started', 'completed')),
  changed_by uuid not null references auth.users(id) on delete restrict,
  final_answer text,
  created_at timestamptz not null default now(),
  unique (issue_id, to_status),
  check (
    (from_status is null and to_status = 'received' and reason = 'submitted') or
    (from_status = 'received' and to_status = 'viewed' and reason = 'opened') or
    (from_status = 'viewed' and to_status = 'in_progress' and reason = 'processing_started') or
    (from_status = 'in_progress' and to_status = 'completed' and reason = 'completed')
  ),
  check (
    (to_status = 'completed' and final_answer = btrim(final_answer) and char_length(final_answer) between 10 and 2000) or
    (to_status <> 'completed' and final_answer is null)
  )
);

create index issue_status_events_issue_created_idx
  on public.issue_status_events(issue_id, created_at);

create table private.issue_contacts (
  issue_id uuid primary key references public.issues(id) on delete cascade,
  reporter_email text not null check (
    reporter_email = lower(btrim(reporter_email)) and char_length(reporter_email) between 3 and 320
  ),
  verified_at timestamptz not null
);

create table private.issue_photos (
  issue_id uuid primary key references public.issues(id) on delete cascade,
  object_path text not null unique,
  content_type text not null check (content_type = 'image/jpeg'),
  byte_size integer not null check (byte_size between 1 and 10485760),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_at timestamptz not null default now(),
  check (width::bigint * height::bigint <= 25000000)
);

create table private.staff_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table private.completion_email_outbox (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  status_event_id uuid not null unique references public.issue_status_events(id) on delete cascade,
  recipient_email text not null,
  ticket_number text not null,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  lock_token uuid,
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index completion_email_outbox_pending_idx
  on private.completion_email_outbox(next_attempt_at, created_at)
  where sent_at is null;

alter table public.issues enable row level security;
alter table public.issue_status_events enable row level security;
alter table private.issue_contacts enable row level security;
alter table private.issue_photos enable row level security;
alter table private.staff_memberships enable row level security;
alter table private.completion_email_outbox enable row level security;

create function private.is_staff(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id is not null and exists (
    select 1
    from private.staff_memberships as membership
    where membership.user_id = target_user_id and membership.active
  );
$$;

revoke all on function private.is_staff(uuid) from public, anon, authenticated, service_role;
grant execute on function private.is_staff(uuid) to authenticated;

create function public.is_staff()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.is_staff((select auth.uid())); $$;

revoke all on function public.is_staff() from public, anon, authenticated, service_role;
grant execute on function public.is_staff() to authenticated;

create function private.can_read_issue(target_issue_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id is not null and exists (
    select 1
    from public.issues as issue
    where issue.id = target_issue_id
      and (issue.reporter_id = target_user_id or private.is_staff(target_user_id))
  );
$$;

revoke all on function private.can_read_issue(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function private.can_read_issue(uuid, uuid) to authenticated;

create policy issues_read_owner_or_staff
on public.issues for select
to authenticated
using (reporter_id = (select auth.uid()) or private.is_staff((select auth.uid())));

create policy issue_events_read_owner_or_staff
on public.issue_status_events for select
to authenticated
using (private.can_read_issue(issue_id, (select auth.uid())));

revoke all on public.issues from public, anon, authenticated, service_role;
revoke all on public.issue_status_events from public, anon, authenticated, service_role;
revoke all on private.issue_contacts from public, anon, authenticated, service_role;
revoke all on private.issue_photos from public, anon, authenticated, service_role;
revoke all on private.staff_memberships from public, anon, authenticated, service_role;
revoke all on private.completion_email_outbox from public, anon, authenticated, service_role;

grant select (
  id, ticket_number, reporter_id, submission_key, category, district_id, latitude, longitude,
  title, body, status, visibility, assigned_department, status_changed_at, created_at, updated_at
) on public.issues to authenticated;

grant select (
  id, issue_id, from_status, to_status, reason, final_answer, created_at
) on public.issue_status_events to authenticated;

grant usage on type public.issue_category, public.issue_status, public.issue_visibility
to authenticated, service_role;

create function private.issue_detail(target_issue_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'issue', to_jsonb(issue) - 'reporter_id' - 'submission_key',
    'contact', jsonb_build_object('email', contact.reporter_email),
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', event.id,
          'fromStatus', event.from_status,
          'toStatus', event.to_status,
          'reason', event.reason,
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
  where issue.id = target_issue_id;
$$;

revoke all on function private.issue_detail(uuid) from public, anon, authenticated, service_role;

create function private.submit_issue(
  target_reporter_id uuid,
  target_submission_key uuid,
  target_category public.issue_category,
  target_district_id text,
  target_latitude double precision,
  target_longitude double precision,
  target_title text,
  target_body text,
  target_photo_path text,
  target_photo_bytes integer,
  target_photo_width integer,
  target_photo_height integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_email text;
  verified_at timestamptz;
  user_is_anonymous boolean;
  expected_photo_prefix text := target_reporter_id::text || '/' || target_submission_key::text || '/';
  existing_issue public.issues%rowtype;
  existing_photo private.issue_photos%rowtype;
  created_issue public.issues%rowtype;
  next_ticket text;
begin
  if target_reporter_id is null or target_submission_key is null then
    raise exception using errcode = '22004', message = 'Reporter and submission key are required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_reporter_id::text || ':' || target_submission_key::text, 0)
  );

  select * into existing_issue
  from public.issues
  where reporter_id = target_reporter_id and submission_key = target_submission_key;

  if found then
    select * into existing_photo from private.issue_photos where issue_id = existing_issue.id;
    if existing_issue.category is distinct from target_category
      or existing_issue.district_id is distinct from target_district_id
      or existing_issue.latitude is distinct from target_latitude
      or existing_issue.longitude is distinct from target_longitude
      or existing_issue.title is distinct from btrim(target_title)
      or existing_issue.body is distinct from btrim(target_body)
      or existing_photo.object_path is distinct from target_photo_path
      or existing_photo.byte_size is distinct from target_photo_bytes
      or existing_photo.width is distinct from target_photo_width
      or existing_photo.height is distinct from target_photo_height then
      raise exception using errcode = '23505', message = 'Submission key was already used with different content';
    end if;
    return jsonb_build_object(
      'created', false,
      'id', existing_issue.id,
      'ticketNumber', existing_issue.ticket_number,
      'status', existing_issue.status,
      'createdAt', existing_issue.created_at
    );
  end if;

  select lower(btrim(user_record.email)), user_record.email_confirmed_at, user_record.is_anonymous
  into verified_email, verified_at, user_is_anonymous
  from auth.users as user_record
  where user_record.id = target_reporter_id;

  if not found or verified_email is null or verified_at is null or coalesce(user_is_anonymous, false) then
    raise exception using errcode = '42501', message = 'Verified email user is required';
  end if;
  if not starts_with(target_photo_path, expected_photo_prefix) or target_photo_path !~ '/[0-9a-f]{64}\.jpg$' then
    raise exception using errcode = '22023', message = 'Photo path does not match the submission';
  end if;
  if not exists (
    select 1 from storage.objects as object
    where object.bucket_id = 'issue-photos' and object.name = target_photo_path
  ) then
    raise exception using errcode = '22023', message = 'Processed photo is missing';
  end if;

  next_ticket := 'CP-' || to_char(clock_timestamp() at time zone 'UTC', 'YYYYMMDD') || '-'
    || lpad(nextval('private.civic_ticket_number_seq'::regclass)::text, 6, '0');

  insert into public.issues (
    ticket_number, reporter_id, submission_key, category, district_id, latitude, longitude, title, body
  ) values (
    next_ticket, target_reporter_id, target_submission_key, target_category, target_district_id,
    target_latitude, target_longitude, btrim(target_title), btrim(target_body)
  ) returning * into created_issue;

  insert into private.issue_contacts(issue_id, reporter_email, verified_at)
  values (created_issue.id, verified_email, verified_at);

  insert into private.issue_photos(issue_id, object_path, content_type, byte_size, width, height)
  values (
    created_issue.id, target_photo_path, 'image/jpeg', target_photo_bytes,
    target_photo_width, target_photo_height
  );

  insert into public.issue_status_events(issue_id, from_status, to_status, reason, changed_by)
  values (created_issue.id, null, 'received', 'submitted', target_reporter_id);

  return jsonb_build_object(
    'created', true,
    'id', created_issue.id,
    'ticketNumber', created_issue.ticket_number,
    'status', created_issue.status,
    'createdAt', created_issue.created_at
  );
end;
$$;

revoke all on function private.submit_issue(
  uuid, uuid, public.issue_category, text, double precision, double precision,
  text, text, text, integer, integer, integer
) from public, anon, authenticated, service_role;
grant execute on function private.submit_issue(
  uuid, uuid, public.issue_category, text, double precision, double precision,
  text, text, text, integer, integer, integer
) to service_role;

create function public.submit_issue(
  target_reporter_id uuid,
  target_submission_key uuid,
  target_category public.issue_category,
  target_district_id text,
  target_latitude double precision,
  target_longitude double precision,
  target_title text,
  target_body text,
  target_photo_path text,
  target_photo_bytes integer,
  target_photo_width integer,
  target_photo_height integer
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.submit_issue(
    target_reporter_id, target_submission_key, target_category, target_district_id,
    target_latitude, target_longitude, target_title, target_body, target_photo_path,
    target_photo_bytes, target_photo_width, target_photo_height
  );
$$;

revoke all on function public.submit_issue(
  uuid, uuid, public.issue_category, text, double precision, double precision,
  text, text, text, integer, integer, integer
) from public, anon, authenticated, service_role;
grant execute on function public.submit_issue(
  uuid, uuid, public.issue_category, text, double precision, double precision,
  text, text, text, integer, integer, integer
) to service_role;

create function private.require_staff()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null or not private.is_staff(actor_id) then
    raise exception using errcode = '42501', message = 'Active staff membership is required';
  end if;
  return actor_id;
end;
$$;

revoke all on function private.require_staff() from public, anon, authenticated, service_role;
grant execute on function private.require_staff() to authenticated;

create function private.acknowledge_issue(target_issue_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_staff();
  current_issue public.issues%rowtype;
begin
  select * into current_issue from public.issues where id = target_issue_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'Issue is unavailable';
  end if;
  if current_issue.status = 'received' then
    update public.issues
    set status = 'viewed', status_changed_at = now(), updated_at = now()
    where id = target_issue_id;
    insert into public.issue_status_events(issue_id, from_status, to_status, reason, changed_by)
    values (target_issue_id, 'received', 'viewed', 'opened', actor_id);
  end if;
  return private.issue_detail(target_issue_id);
end;
$$;

revoke all on function private.acknowledge_issue(uuid) from public, anon, authenticated, service_role;
grant execute on function private.acknowledge_issue(uuid) to authenticated;

create function public.acknowledge_issue(target_issue_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.acknowledge_issue(target_issue_id); $$;

revoke all on function public.acknowledge_issue(uuid) from public, anon, authenticated, service_role;
grant execute on function public.acknowledge_issue(uuid) to authenticated;

create function private.start_issue(target_issue_id uuid, target_department text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_staff();
  current_issue public.issues%rowtype;
begin
  if target_department is not null and target_department not in (
    'road_maintenance', 'public_facilities', 'traffic_safety',
    'environmental_services', 'general_services'
  ) then
    raise exception using errcode = '22023', message = 'Unknown department';
  end if;
  select * into current_issue from public.issues where id = target_issue_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'Issue is unavailable';
  end if;
  if current_issue.status = 'in_progress' then
    if current_issue.assigned_department is distinct from target_department then
      raise exception using errcode = '23505', message = 'Issue was already started with a different department';
    end if;
    return private.issue_detail(target_issue_id);
  end if;
  if current_issue.status <> 'viewed' then
    raise exception using errcode = '22023', message = 'Issue must be viewed before processing';
  end if;
  update public.issues
  set status = 'in_progress', assigned_department = target_department,
      status_changed_at = now(), updated_at = now()
  where id = target_issue_id;
  insert into public.issue_status_events(issue_id, from_status, to_status, reason, changed_by)
  values (target_issue_id, 'viewed', 'in_progress', 'processing_started', actor_id);
  return private.issue_detail(target_issue_id);
end;
$$;

revoke all on function private.start_issue(uuid, text) from public, anon, authenticated, service_role;
grant execute on function private.start_issue(uuid, text) to authenticated;

create function public.start_issue(target_issue_id uuid, target_department text default null)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.start_issue(target_issue_id, target_department); $$;

revoke all on function public.start_issue(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.start_issue(uuid, text) to authenticated;

create function private.complete_issue(target_issue_id uuid, target_final_answer text)
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

  return private.issue_detail(target_issue_id);
end;
$$;

revoke all on function private.complete_issue(uuid, text) from public, anon, authenticated, service_role;
grant execute on function private.complete_issue(uuid, text) to authenticated;

create function public.complete_issue(target_issue_id uuid, target_final_answer text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.complete_issue(target_issue_id, target_final_answer); $$;

revoke all on function public.complete_issue(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.complete_issue(uuid, text) to authenticated;

create function private.authorize_issue_photo(target_issue_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  result_path text;
begin
  if not private.can_read_issue(target_issue_id, actor_id) then
    raise exception using errcode = '42501', message = 'Photo is unavailable';
  end if;
  select object_path into result_path from private.issue_photos where issue_id = target_issue_id;
  if result_path is null then
    raise exception using errcode = '42501', message = 'Photo is unavailable';
  end if;
  return result_path;
end;
$$;

revoke all on function private.authorize_issue_photo(uuid) from public, anon, authenticated, service_role;
grant execute on function private.authorize_issue_photo(uuid) to authenticated;

create function public.authorize_issue_photo(target_issue_id uuid)
returns text
language sql
security invoker
set search_path = ''
as $$ select private.authorize_issue_photo(target_issue_id); $$;

revoke all on function public.authorize_issue_photo(uuid) from public, anon, authenticated, service_role;
grant execute on function public.authorize_issue_photo(uuid) to authenticated;

create function private.claim_completion_emails(target_limit integer, target_lock_token uuid)
returns table (
  id uuid,
  issue_id uuid,
  status_event_id uuid,
  recipient_email text,
  ticket_number text,
  attempts integer,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_limit is null or target_limit not between 1 and 50 or target_lock_token is null then
    raise exception using errcode = '22023', message = 'Invalid email claim';
  end if;
  return query
  with claimed as (
    select outbox.id, event.created_at as completed_at
    from private.completion_email_outbox as outbox
    join public.issue_status_events as event on event.id = outbox.status_event_id
    where outbox.sent_at is null
      and outbox.next_attempt_at <= now()
      and (outbox.locked_at is null or outbox.locked_at < now() - interval '5 minutes')
    order by outbox.created_at
    for update of outbox skip locked
    limit target_limit
  )
  update private.completion_email_outbox as outbox
  set lock_token = target_lock_token, locked_at = now(), attempts = outbox.attempts + 1
  from claimed
  where outbox.id = claimed.id
  returning outbox.id, outbox.issue_id, outbox.status_event_id,
    outbox.recipient_email, outbox.ticket_number, outbox.attempts, claimed.completed_at;
end;
$$;

revoke all on function private.claim_completion_emails(integer, uuid)
from public, anon, authenticated, service_role;
grant execute on function private.claim_completion_emails(integer, uuid) to service_role;

create function public.claim_completion_emails(target_limit integer, target_lock_token uuid)
returns table (
  id uuid,
  issue_id uuid,
  status_event_id uuid,
  recipient_email text,
  ticket_number text,
  attempts integer,
  completed_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$ select * from private.claim_completion_emails(target_limit, target_lock_token); $$;

revoke all on function public.claim_completion_emails(integer, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.claim_completion_emails(integer, uuid) to service_role;

create function private.finish_completion_email(
  target_id uuid,
  target_lock_token uuid,
  target_sent boolean,
  target_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_id is null or target_lock_token is null or target_sent is null then
    raise exception using errcode = '22023', message = 'Invalid email completion';
  end if;
  if target_sent then
    update private.completion_email_outbox
    set sent_at = now(), lock_token = null, locked_at = null, last_error = null
    where id = target_id and lock_token = target_lock_token and sent_at is null;
  else
    update private.completion_email_outbox
    set next_attempt_at = now() + case
          when attempts <= 1 then interval '30 seconds'
          when attempts = 2 then interval '1 minute'
          when attempts = 3 then interval '2 minutes'
          else interval '10 minutes'
        end,
        lock_token = null,
        locked_at = null,
        last_error = left(coalesce(target_error, 'Unknown delivery error'), 500)
    where id = target_id and lock_token = target_lock_token and sent_at is null;
  end if;
  return found;
end;
$$;

revoke all on function private.finish_completion_email(uuid, uuid, boolean, text)
from public, anon, authenticated, service_role;
grant execute on function private.finish_completion_email(uuid, uuid, boolean, text) to service_role;

create function public.finish_completion_email(
  target_id uuid,
  target_lock_token uuid,
  target_sent boolean,
  target_error text default null
)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.finish_completion_email(target_id, target_lock_token, target_sent, target_error); $$;

revoke all on function public.finish_completion_email(uuid, uuid, boolean, text)
from public, anon, authenticated, service_role;
grant execute on function public.finish_completion_email(uuid, uuid, boolean, text) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('issue-photos', 'issue-photos', false, 10485760, array['image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';

commit;
