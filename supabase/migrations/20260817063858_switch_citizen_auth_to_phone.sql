alter table private.issue_contacts
  alter column reporter_email drop not null,
  add column reporter_phone text,
  add constraint issue_contacts_reporter_phone_check check (
    reporter_phone is null or reporter_phone ~ '^\+[1-9][0-9]{7,14}$'
  ),
  add constraint issue_contacts_verified_identity_check check (
    reporter_email is not null or reporter_phone is not null
  ),
  drop constraint issue_contacts_cell_phone_check,
  add constraint issue_contacts_cell_phone_check check (
    cell_phone is null
    or cell_phone ~ '^\+[1-9][0-9]{7,14}$'
    or reporter_phone is null
      and cell_phone = btrim(cell_phone)
      and cell_phone ~ '^\+?[0-9() -]{8,20}$'
  );

create or replace function private.submit_issue(
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
  verified_phone text;
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

  select
    case when user_record.email_confirmed_at is not null then lower(btrim(user_record.email)) end,
    case
      when user_record.phone_confirmed_at is null then null
      when btrim(user_record.phone) ~ '^\+[1-9][0-9]{7,14}$' then btrim(user_record.phone)
      when btrim(user_record.phone) ~ '^[1-9][0-9]{7,14}$' then '+' || btrim(user_record.phone)
    end,
    coalesce(user_record.phone_confirmed_at, user_record.email_confirmed_at),
    user_record.is_anonymous
  into verified_email, verified_phone, verified_at, user_is_anonymous
  from auth.users as user_record
  where user_record.id = target_reporter_id;

  if not found or (verified_email is null and verified_phone is null)
    or verified_at is null or coalesce(user_is_anonymous, false) then
    raise exception using errcode = '42501', message = 'Verified email or phone user is required';
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

  insert into private.issue_contacts(issue_id, reporter_email, reporter_phone, verified_at)
  values (created_issue.id, verified_email, verified_phone, verified_at);

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

create or replace function private.store_issue_contact_profile(
  target_issue_id uuid,
  target_real_name text,
  target_gender text,
  target_age_group text,
  target_cell_phone text,
  target_line_id text,
  target_contact_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_real_name text := btrim(target_real_name);
  clean_cell_phone text := btrim(target_cell_phone);
  clean_line_id text := nullif(btrim(target_line_id), '');
  clean_contact_email text := nullif(lower(btrim(target_contact_email)), '');
  stored private.issue_contacts%rowtype;
begin
  if target_issue_id is null
    or clean_real_name is null or char_length(clean_real_name) not between 1 and 100
    or target_gender is null or target_gender not in ('male', 'female', 'other')
    or target_age_group is null or target_age_group not in ('20_or_younger', '21_30', '31_40', '41_50', '51_60', '61_or_older')
    or clean_cell_phone is null or clean_cell_phone !~ '^\+[1-9][0-9]{7,14}$'
    or clean_line_id is not null and char_length(clean_line_id) > 50
    or clean_contact_email is not null and (
      char_length(clean_contact_email) not between 3 and 320
      or clean_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ) then
    raise exception using errcode = '22023', message = 'A valid citizen contact profile is required';
  end if;

  select * into stored
  from private.issue_contacts
  where issue_id = target_issue_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'Issue contact row is missing';
  end if;
  if stored.reporter_phone is not null and stored.reporter_phone <> clean_cell_phone then
    raise exception using errcode = '42501', message = 'Contact phone must match the verified phone';
  end if;

  if stored.real_name is not null or stored.gender is not null or stored.age_group is not null
    or stored.cell_phone is not null or stored.line_id is not null or stored.contact_email is not null then
    if stored.real_name is distinct from clean_real_name
      or stored.gender is distinct from target_gender
      or stored.age_group is distinct from target_age_group
      or stored.cell_phone is distinct from clean_cell_phone
      or stored.line_id is distinct from clean_line_id
      or stored.contact_email is distinct from clean_contact_email then
      raise exception using errcode = '23505', message = 'Submission key was already used with different contact details';
    end if;
    return;
  end if;

  update private.issue_contacts
  set real_name = clean_real_name,
      gender = target_gender,
      age_group = target_age_group,
      cell_phone = clean_cell_phone,
      line_id = clean_line_id,
      contact_email = clean_contact_email
  where issue_id = target_issue_id;
end;
$$;

create or replace function private.issue_detail(target_issue_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.issue_detail_without_contact_profile(target_issue_id) || jsonb_build_object(
    'contact', jsonb_build_object(
      'email', contact.reporter_email,
      'phone', contact.reporter_phone,
      'realName', contact.real_name,
      'gender', contact.gender,
      'ageGroup', contact.age_group,
      'cellPhone', contact.cell_phone,
      'lineId', contact.line_id,
      'contactEmail', contact.contact_email
    )
  )
  from private.issue_contacts as contact
  where contact.issue_id = target_issue_id;
$$;

create or replace function private.create_recurrence_capture_token(
  target_user_id uuid,
  target_source_issue_id uuid,
  target_token_hash text,
  target_latitude double precision,
  target_longitude double precision,
  target_accuracy_meters double precision,
  target_ip_hash text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  token_expiry timestamptz := now() + interval '5 minutes';
  source_issue public.issues%rowtype;
  distance_to_source double precision;
begin
  if target_user_id is null or target_source_issue_id is null
    or target_token_hash !~ '^[0-9a-f]{64}$'
    or target_ip_hash !~ '^[0-9a-f]{64}$'
    or target_latitude not between 24.589 and 25.124
    or target_longitude not between 120.966 and 121.477
    or target_accuracy_meters not between 0 and 500
    or not exists (
      select 1 from auth.users
      where id = target_user_id
        and (email_confirmed_at is not null or phone_confirmed_at is not null)
        and not coalesce(is_anonymous, false)
    ) then
    raise exception using errcode = '22023', message = 'Invalid recurrence capture request';
  end if;

  select issue.* into source_issue
  from public.issues as issue
  join private.issue_problem_spots as link on link.issue_id = issue.id
  join private.problem_spots as spot on spot.id = link.problem_spot_id
  where issue.id = target_source_issue_id
    and issue.reporter_id = target_user_id
    and issue.status = 'completed'
    and spot.field_status <> 'resolved_confirmed';
  if not found then
    raise exception using errcode = '42501', message = 'Completed source issue is unavailable';
  end if;

  distance_to_source := private.distance_meters(
    target_latitude, target_longitude, source_issue.latitude, source_issue.longitude
  );
  if distance_to_source > 500 then
    raise exception using errcode = '22023', message = 'Current location is too far from the source issue';
  end if;

  if (select count(*) from private.recurrence_capture_tokens
      where user_id = target_user_id and created_at > now() - interval '15 minutes') >= 5
    or (select count(*) from private.recurrence_capture_tokens
      where ip_hash = target_ip_hash and created_at > now() - interval '15 minutes') >= 20 then
    raise exception using errcode = 'P0001', message = 'Recurrence capture rate limit exceeded';
  end if;

  insert into private.recurrence_capture_tokens(
    token_hash, user_id, source_issue_id, source_distance_meters,
    latitude, longitude, accuracy_meters, ip_hash, expires_at
  ) values (
    target_token_hash, target_user_id, target_source_issue_id, distance_to_source,
    target_latitude, target_longitude, target_accuracy_meters, target_ip_hash, token_expiry
  );
  return token_expiry;
end;
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

  select coalesce(reporter_email, contact_email) into recipient
  from private.issue_contacts where issue_id = target_issue_id;
  if recipient is not null then
    insert into private.completion_email_outbox(
      issue_id, status_event_id, recipient_email, ticket_number
    ) values (
      target_issue_id, completion_event_id, recipient, current_issue.ticket_number
    );
  end if;

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

create or replace function private.enqueue_hold_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.to_status = 'on_hold' then
    insert into private.completion_email_outbox(
      issue_id, status_event_id, recipient_email, ticket_number, email_type
    )
    select new.issue_id, new.id, coalesce(contact.reporter_email, contact.contact_email),
      issue.ticket_number, 'on_hold'
    from public.issues as issue
    join private.issue_contacts as contact on contact.issue_id = issue.id
    where issue.id = new.issue_id
      and coalesce(contact.reporter_email, contact.contact_email) is not null;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
