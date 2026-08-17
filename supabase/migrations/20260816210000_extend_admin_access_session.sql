-- Keep a verified administrator session active for up to seven days.
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

  access_expiry := least(coalesce(current_session.not_after, now() + interval '7 days'), now() + interval '7 days');
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
