alter table public.issues
  add column address text,
  add constraint issues_address_check check (
    address is null or address = btrim(address) and char_length(address) between 1 and 500
  );

grant select (address) on public.issues to authenticated;

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
  target_address text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  issue_id uuid;
  stored_address text;
begin
  if target_address is null or target_address <> btrim(target_address)
    or char_length(target_address) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'A valid issue address is required';
  end if;
  result := private.submit_issue(
    target_reporter_id, target_submission_key, target_category, target_district_id,
    target_latitude, target_longitude, target_title, target_body, target_photo_path,
    target_photo_bytes, target_photo_width, target_photo_height
  );
  issue_id := (result ->> 'id')::uuid;
  select address into stored_address from public.issues where id = issue_id;
  if stored_address is not null and stored_address <> target_address then
    raise exception using errcode = '23505', message = 'Submission key was already used with different content';
  end if;
  update public.issues set address = target_address where id = issue_id and address is null;
  return result;
end;
$$;

revoke all on function private.submit_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,
  text,text,text,integer,integer,integer,text
) from public, anon, authenticated, service_role;
grant execute on function private.submit_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,
  text,text,text,integer,integer,integer,text
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
  target_address text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.submit_issue(
  target_reporter_id, target_submission_key, target_category, target_district_id,
  target_latitude, target_longitude, target_title, target_body, target_photo_path,
  target_photo_bytes, target_photo_width, target_photo_height, target_address
); $$;

revoke all on function public.submit_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,
  text,text,text,integer,integer,integer,text
) from public, anon, authenticated, service_role;
grant execute on function public.submit_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,
  text,text,text,integer,integer,integer,text
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
  target_address text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  issue_id uuid;
  source_address text;
  stored_address text;
begin
  if target_address is null or target_address <> btrim(target_address)
    or char_length(target_address) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'A valid issue address is required';
  end if;
  select source.address into source_address
  from private.recurrence_capture_tokens as capture
  join public.issues as source on source.id = capture.source_issue_id
  where capture.token_hash = target_token_hash;
  result := private.submit_recurrence_issue(
    target_reporter_id, target_submission_key, target_category, target_district_id,
    target_latitude, target_longitude, target_title, target_body, target_photo_path,
    target_photo_bytes, target_photo_width, target_photo_height, target_token_hash
  );
  issue_id := (result ->> 'id')::uuid;
  target_address := coalesce(source_address, target_address);
  select address into stored_address from public.issues where id = issue_id;
  if stored_address is not null and stored_address <> target_address then
    raise exception using errcode = '23505', message = 'Submission key was already used with different content';
  end if;
  update public.issues set address = target_address where id = issue_id and address is null;
  return result;
end;
$$;

revoke all on function private.submit_recurrence_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,
  text,text,text,integer,integer,integer,text,text
) from public, anon, authenticated, service_role;
grant execute on function private.submit_recurrence_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,
  text,text,text,integer,integer,integer,text,text
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
  target_address text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.submit_recurrence_issue(
  target_reporter_id, target_submission_key, target_category, target_district_id,
  target_latitude, target_longitude, target_title, target_body, target_photo_path,
  target_photo_bytes, target_photo_width, target_photo_height, target_token_hash, target_address
); $$;

revoke all on function public.submit_recurrence_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,
  text,text,text,integer,integer,integer,text,text
) from public, anon, authenticated, service_role;
grant execute on function public.submit_recurrence_issue(
  uuid,uuid,public.issue_category,text,double precision,double precision,
  text,text,text,integer,integer,integer,text,text
) to service_role;

notify pgrst, 'reload schema';
