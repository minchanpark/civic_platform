alter table private.staff_memberships
  add column staff_number_hash text,
  add column mfa_required boolean not null default true,
  add constraint staff_memberships_number_hash_check check (
    staff_number_hash is null or staff_number_hash ~ '^\$2[aby]\$'
  ),
  add constraint staff_memberships_mfa_required_check check (mfa_required);

create table private.staff_access_sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  number_verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > number_verified_at)
);

create index staff_access_sessions_user_expiry_idx
  on private.staff_access_sessions(user_id, expires_at desc);

create table private.staff_auth_rate_limits (
  scope text not null check (scope in (
    'otp-send-email', 'otp-send-ip', 'otp-verify-email', 'otp-verify-ip',
    'staff-number-user', 'staff-number-ip'
  )),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  attempts integer not null default 0 check (attempts >= 0),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  primary key (scope, key_hash)
);

create index staff_auth_rate_limits_locked_idx
  on private.staff_auth_rate_limits(locked_until)
  where locked_until is not null;

create table private.staff_access_audit (
  id bigint generated always as identity primary key,
  user_id uuid,
  session_id uuid,
  event text not null check (event in ('number_verified', 'number_rejected', 'number_locked')),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index staff_access_audit_user_created_idx
  on private.staff_access_audit(user_id, created_at desc);

alter table private.staff_access_sessions enable row level security;
alter table private.staff_auth_rate_limits enable row level security;
alter table private.staff_access_audit enable row level security;

revoke all on private.staff_access_sessions from public, anon, authenticated, service_role;
revoke all on private.staff_auth_rate_limits from public, anon, authenticated, service_role;
revoke all on private.staff_access_audit from public, anon, authenticated, service_role;
revoke all on sequence private.staff_access_audit_id_seq from public, anon, authenticated, service_role;

create function private.staff_membership_active(target_user_id uuid)
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
      and membership.mfa_required
      and membership.staff_number_hash is not null
  );
$$;

revoke all on function private.staff_membership_active(uuid) from public, anon, authenticated, service_role;

create or replace function private.is_staff(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id is not null
    and target_user_id = (select auth.uid())
    and (select auth.jwt() ->> 'aal') = 'aal2'
    and private.staff_membership_active(target_user_id)
    and exists (
      select 1
      from private.staff_access_sessions as access
      join auth.sessions as session on session.id = access.session_id
      where access.user_id = target_user_id
        and access.session_id = nullif((select auth.jwt() ->> 'session_id'), '')::uuid
        and access.expires_at > now()
        and session.user_id = target_user_id
        and session.aal = 'aal2'
        and (session.not_after is null or session.not_after > now())
    );
$$;

create function private.staff_access_state()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'membershipActive', private.staff_membership_active((select auth.uid())),
    'aal2', (select auth.jwt() ->> 'aal') = 'aal2',
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

revoke all on function private.staff_access_state() from public, anon, authenticated, service_role;
grant execute on function private.staff_access_state() to authenticated;

create function public.staff_access_state()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.staff_access_state();
$$;

revoke all on function public.staff_access_state() from public, anon, authenticated, service_role;
grant execute on function public.staff_access_state() to authenticated;

create function private.consume_staff_auth_rate_limit(
  target_scope text,
  target_key_hash text,
  target_limit integer,
  target_window_seconds integer,
  target_lock_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_limit private.staff_auth_rate_limits%rowtype;
  observed_at timestamptz := clock_timestamp();
  retry_after integer;
begin
  if target_scope not in (
    'otp-send-email', 'otp-send-ip', 'otp-verify-email', 'otp-verify-ip',
    'staff-number-user', 'staff-number-ip'
  ) or target_key_hash !~ '^[0-9a-f]{64}$'
    or target_limit not between 1 and 20
    or target_window_seconds not between 60 and 3600
    or target_lock_seconds not between 60 and 86400 then
    raise exception using errcode = '22023', message = 'Invalid staff auth rate limit';
  end if;

  insert into private.staff_auth_rate_limits(scope, key_hash)
  values (target_scope, target_key_hash)
  on conflict do nothing;

  select * into current_limit
  from private.staff_auth_rate_limits
  where scope = target_scope and key_hash = target_key_hash
  for update;

  if current_limit.locked_until is not null and current_limit.locked_until > observed_at then
    retry_after := greatest(1, ceil(extract(epoch from current_limit.locked_until - observed_at))::integer);
    return jsonb_build_object('allowed', false, 'retryAfter', retry_after);
  end if;

  if current_limit.window_started_at <= observed_at - make_interval(secs => target_window_seconds) then
    update private.staff_auth_rate_limits
    set attempts = 1, window_started_at = observed_at, locked_until = null
    where scope = target_scope and key_hash = target_key_hash;
    return jsonb_build_object('allowed', true, 'retryAfter', 0);
  end if;

  if current_limit.attempts >= target_limit then
    update private.staff_auth_rate_limits
    set locked_until = observed_at + make_interval(secs => target_lock_seconds)
    where scope = target_scope and key_hash = target_key_hash;
    return jsonb_build_object('allowed', false, 'retryAfter', target_lock_seconds);
  end if;

  update private.staff_auth_rate_limits
  set attempts = attempts + 1
  where scope = target_scope and key_hash = target_key_hash;
  return jsonb_build_object('allowed', true, 'retryAfter', 0);
end;
$$;

revoke all on function private.consume_staff_auth_rate_limit(text,text,integer,integer,integer)
  from public, anon, authenticated, service_role;
grant execute on function private.consume_staff_auth_rate_limit(text,text,integer,integer,integer)
  to service_role;

create function public.consume_admin_auth_rate_limit(
  target_scope text,
  target_key_hash text,
  target_limit integer,
  target_window_seconds integer,
  target_lock_seconds integer
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.consume_staff_auth_rate_limit(
    target_scope, target_key_hash, target_limit, target_window_seconds, target_lock_seconds
  );
$$;

revoke all on function public.consume_admin_auth_rate_limit(text,text,integer,integer,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.consume_admin_auth_rate_limit(text,text,integer,integer,integer)
  to service_role;

create function private.verify_staff_number(
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
    and current_session.aal = 'aal2'
    and (current_session.not_after is null or current_session.not_after > now())
    and membership.active
    and membership.mfa_required
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

revoke all on function private.verify_staff_number(uuid,uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function private.verify_staff_number(uuid,uuid,text,text) to service_role;

create function public.verify_staff_number(
  target_user_id uuid,
  target_session_id uuid,
  target_staff_number text,
  target_ip_hash text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.verify_staff_number(
    target_user_id, target_session_id, target_staff_number, target_ip_hash
  );
$$;

revoke all on function public.verify_staff_number(uuid,uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.verify_staff_number(uuid,uuid,text,text) to service_role;

create function private.provision_staff(target_user_id uuid, target_staff_number text)
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

  insert into private.staff_memberships(user_id, active, staff_number_hash, mfa_required)
  values (
    target_user_id,
    true,
    extensions.crypt(target_staff_number, extensions.gen_salt('bf', 10)),
    true
  )
  on conflict (user_id) do update
  set active = true,
      staff_number_hash = excluded.staff_number_hash,
      mfa_required = true;

  delete from private.staff_access_sessions where user_id = target_user_id;
  return true;
end;
$$;

revoke all on function private.provision_staff(uuid,text) from public, anon, authenticated, service_role;
grant execute on function private.provision_staff(uuid,text) to service_role;

create function public.provision_staff(target_user_id uuid, target_staff_number text)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.provision_staff(target_user_id, target_staff_number); $$;

revoke all on function public.provision_staff(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.provision_staff(uuid,text) to service_role;

notify pgrst, 'reload schema';
