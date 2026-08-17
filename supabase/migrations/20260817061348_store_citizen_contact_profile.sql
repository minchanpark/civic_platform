alter table private.issue_contacts
  add column real_name text,
  add column gender text,
  add column age_group text,
  add column cell_phone text,
  add column line_id text,
  add column contact_email text,
  add constraint issue_contacts_real_name_check check (
    real_name is null or real_name = btrim(real_name) and char_length(real_name) between 1 and 100
  ),
  add constraint issue_contacts_gender_check check (
    gender is null or gender in ('male', 'female', 'other')
  ),
  add constraint issue_contacts_age_group_check check (
    age_group is null or age_group in ('20_or_younger', '21_30', '31_40', '41_50', '51_60', '61_or_older')
  ),
  add constraint issue_contacts_cell_phone_check check (
    cell_phone is null or cell_phone = btrim(cell_phone) and cell_phone ~ '^\+?[0-9() -]{8,20}$'
  ),
  add constraint issue_contacts_line_id_check check (
    line_id is null or line_id = btrim(line_id) and char_length(line_id) between 1 and 50
  ),
  add constraint issue_contacts_contact_email_check check (
    contact_email is null or contact_email = lower(btrim(contact_email))
      and char_length(contact_email) between 3 and 320
      and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );

create function private.store_issue_contact_profile(
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
    or clean_cell_phone is null or clean_cell_phone !~ '^\+?[0-9() -]{8,20}$'
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

revoke all on function private.store_issue_contact_profile(uuid,text,text,text,text,text,text)
from public, anon, authenticated, service_role;

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
  target_photo_height integer,
  target_address text,
  target_real_name text,
  target_gender text,
  target_age_group text,
  target_cell_phone text,
  target_line_id text,
  target_contact_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  result := private.submit_issue(
    target_reporter_id, target_submission_key, target_category, target_district_id,
    target_latitude, target_longitude, target_title, target_body, target_photo_path,
    target_photo_bytes, target_photo_width, target_photo_height, target_address
  );
  perform private.store_issue_contact_profile(
    (result ->> 'id')::uuid, target_real_name, target_gender, target_age_group,
    target_cell_phone, target_line_id, target_contact_email
  );
  return result;
end;
$$;

revoke all on function private.submit_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,
  text,text,text,integer,integer,integer,text,text,text,text,text,text,text
) from public, anon, authenticated, service_role;
grant execute on function private.submit_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,
  text,text,text,integer,integer,integer,text,text,text,text,text,text,text
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
  target_photo_height integer,
  target_address text,
  target_real_name text,
  target_gender text,
  target_age_group text,
  target_cell_phone text,
  target_line_id text,
  target_contact_email text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.submit_issue(
  target_reporter_id, target_submission_key, target_category, target_district_id,
  target_latitude, target_longitude, target_title, target_body, target_photo_path,
  target_photo_bytes, target_photo_width, target_photo_height, target_address,
  target_real_name, target_gender, target_age_group, target_cell_phone,
  target_line_id, target_contact_email
); $$;

revoke all on function public.submit_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,
  text,text,text,integer,integer,integer,text,text,text,text,text,text,text
) from public, anon, authenticated, service_role;
grant execute on function public.submit_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,
  text,text,text,integer,integer,integer,text,text,text,text,text,text,text
) to service_role;

create function private.submit_recurrence_issue(
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
  target_photo_height integer,
  target_token_hash text,
  target_address text,
  target_real_name text,
  target_gender text,
  target_age_group text,
  target_cell_phone text,
  target_line_id text,
  target_contact_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  result := private.submit_recurrence_issue(
    target_reporter_id, target_submission_key, target_category, target_district_id,
    target_latitude, target_longitude, target_title, target_body, target_photo_path,
    target_photo_bytes, target_photo_width, target_photo_height, target_token_hash,
    target_address
  );
  perform private.store_issue_contact_profile(
    (result ->> 'id')::uuid, target_real_name, target_gender, target_age_group,
    target_cell_phone, target_line_id, target_contact_email
  );
  return result;
end;
$$;

revoke all on function private.submit_recurrence_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,
  text,text,text,integer,integer,integer,text,text,text,text,text,text,text,text
) from public, anon, authenticated, service_role;
grant execute on function private.submit_recurrence_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,
  text,text,text,integer,integer,integer,text,text,text,text,text,text,text,text
) to service_role;

create function public.submit_recurrence_issue(
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
  target_photo_height integer,
  target_token_hash text,
  target_address text,
  target_real_name text,
  target_gender text,
  target_age_group text,
  target_cell_phone text,
  target_line_id text,
  target_contact_email text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.submit_recurrence_issue(
  target_reporter_id, target_submission_key, target_category, target_district_id,
  target_latitude, target_longitude, target_title, target_body, target_photo_path,
  target_photo_bytes, target_photo_width, target_photo_height, target_token_hash,
  target_address, target_real_name, target_gender, target_age_group,
  target_cell_phone, target_line_id, target_contact_email
); $$;

revoke all on function public.submit_recurrence_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,
  text,text,text,integer,integer,integer,text,text,text,text,text,text,text,text
) from public, anon, authenticated, service_role;
grant execute on function public.submit_recurrence_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,
  text,text,text,integer,integer,integer,text,text,text,text,text,text,text,text
) to service_role;

alter function private.issue_detail(uuid) rename to issue_detail_without_contact_profile;
revoke all on function private.issue_detail_without_contact_profile(uuid)
from public, anon, authenticated, service_role;

create function private.issue_detail(target_issue_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.issue_detail_without_contact_profile(target_issue_id) || jsonb_build_object(
    'contact', jsonb_build_object(
      'email', contact.reporter_email,
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

revoke all on function private.issue_detail(uuid)
from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
