create or replace function private.staff_membership_active(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id is not null and exists (
    select 1
    from private.staff_memberships as membership
    where membership.user_id = target_user_id
      and membership.active
      and membership.staff_number_hash is not null
  );
$$;

create or replace function private.is_staff(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id is not null
    and target_user_id = (select auth.uid())
    and private.staff_membership_active(target_user_id)
    and exists (
      select 1
      from private.staff_access_sessions as access
      join auth.sessions as session on session.id = access.session_id
      where access.user_id = target_user_id
        and access.session_id = nullif((select auth.jwt() ->> 'session_id'), '')::uuid
        and access.expires_at > now()
        and session.user_id = target_user_id
        and (session.not_after is null or session.not_after > now())
    );
$$;

create or replace function private.staff_access_state()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'membershipActive', private.staff_membership_active((select auth.uid())),
    'numberVerified', exists (
      select 1
      from private.staff_access_sessions as access
      where access.user_id = (select auth.uid())
        and access.session_id = nullif((select auth.jwt() ->> 'session_id'), '')::uuid
        and access.expires_at > now()
    ),
    'authorized', private.is_staff((select auth.uid()))
  );
$$;

create or replace function private.verify_staff_number(
  target_user_id uuid,
  target_session_id uuid,
  target_staff_number text,
  target_ip_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership private.staff_memberships%rowtype;
  current_session auth.sessions%rowtype;
  user_key text;
  user_limit jsonb;
  ip_limit jsonb;
  verified boolean := false;
  access_expiry timestamptz;
  retry_after integer;
begin
  if target_user_id is null or target_session_id is null or target_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid staff verification request';
  end if;

  user_key := encode(extensions.digest(target_user_id::text, 'sha256'), 'hex');
  user_limit := private.consume_staff_auth_rate_limit('staff-number-user', user_key, 5, 900, 900);
  ip_limit := private.consume_staff_auth_rate_limit('staff-number-ip', target_ip_hash, 5, 900, 900);
  if not (user_limit ->> 'allowed')::boolean or not (ip_limit ->> 'allowed')::boolean then
    retry_after := greatest((user_limit ->> 'retryAfter')::integer, (ip_limit ->> 'retryAfter')::integer);
    insert into private.staff_access_audit(user_id, session_id, event, ip_hash)
    values (target_user_id, target_session_id, 'number_locked', target_ip_hash);
    return jsonb_build_object('authorized', false, 'locked', true, 'retryAfter', retry_after);
  end if;

  select * into membership
  from private.staff_memberships
  where user_id = target_user_id
  for update;

  select * into current_session
  from auth.sessions
  where id = target_session_id and user_id = target_user_id
  for update;

  verified := coalesce(found
    and membership.user_id = target_user_id
    and (current_session.not_after is null or current_session.not_after > now())
    and membership.active
    and membership.staff_number_hash is not null
    and target_staff_number ~ '^[A-Z0-9-]{8,24}$'
    and extensions.crypt(target_staff_number, membership.staff_number_hash) = membership.staff_number_hash, false);

  if not verified then
    insert into private.staff_access_audit(user_id, session_id, event, ip_hash)
    values (target_user_id, target_session_id, 'number_rejected', target_ip_hash);
    return jsonb_build_object('authorized', false, 'locked', false, 'retryAfter', 0);
  end if;

  access_expiry := least(coalesce(current_session.not_after, now() + interval '12 hours'), now() + interval '12 hours');
  insert into private.staff_access_sessions(session_id, user_id, expires_at)
  values (target_session_id, target_user_id, access_expiry)
  on conflict (session_id) do update
  set user_id = excluded.user_id,
      number_verified_at = now(),
      expires_at = excluded.expires_at;

  insert into private.staff_access_audit(user_id, session_id, event, ip_hash)
  values (target_user_id, target_session_id, 'number_verified', target_ip_hash);
  return jsonb_build_object('authorized', true, 'locked', false, 'retryAfter', 0);
end;
$$;

create or replace function private.provision_staff(target_user_id uuid, target_staff_number text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_staff_number !~ '^[A-Z0-9-]{8,24}$' or not exists (
    select 1 from auth.users where id = target_user_id and email_confirmed_at is not null
  ) then
    raise exception using errcode = '22023', message = 'Invalid staff provisioning request';
  end if;

  insert into private.staff_memberships(user_id, active, staff_number_hash)
  values (
    target_user_id,
    true,
    extensions.crypt(target_staff_number, extensions.gen_salt('bf', 10))
  )
  on conflict (user_id) do update
  set active = true,
      staff_number_hash = excluded.staff_number_hash;

  delete from private.staff_access_sessions where user_id = target_user_id;
  return true;
end;
$$;

alter table private.staff_memberships
  drop constraint staff_memberships_mfa_required_check,
  drop column mfa_required;

notify pgrst, 'reload schema';
