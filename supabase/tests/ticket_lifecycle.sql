begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(157);

-- Keep the contract suite independent from real browser-test data while the
-- outer transaction and final rollback preserve the developer's local state.
delete from private.staff_issue_access_audit;
delete from private.completion_email_outbox;
delete from private.issue_risk_overrides;
delete from private.issue_ai_assistance_jobs;
delete from private.issue_ai_assessments;
delete from private.recurrence_evidence;
delete from private.recurrence_candidates;
delete from private.resolution_evidence;
delete from private.field_status_events;
delete from private.issue_problem_spots;
delete from private.problem_spots;
delete from private.issue_photos;
delete from private.issue_contacts;
delete from public.issue_status_events;
delete from public.issues;

select is(
  (select count(*) from pg_enum
   where enumtypid = 'public.issue_category'::regtype
     and enumlabel in ('public_utility','road_obstruction','streetlight_failure','abandoned_vehicle','road_sidewalk','bus_issue','traffic_safety','other')),
  8::bigint,
  'database supports every citizen report category'
);

set local role service_role;
select public.refresh_public_snapshots();
reset role;

select is(
  (
    select count(*)
    from pg_class
    where oid = any(array[
      'public.issues'::regclass,
      'public.issue_status_events'::regclass,
      'private.issue_contacts'::regclass,
      'private.issue_photos'::regclass,
      'private.staff_memberships'::regclass,
      'private.completion_email_outbox'::regclass,
      'private.problem_spots'::regclass,
      'private.issue_problem_spots'::regclass,
      'private.recurrence_candidates'::regclass,
      'private.field_status_events'::regclass,
      'public.district_public_snapshots'::regclass,
      'private.staff_access_sessions'::regclass,
      'private.staff_auth_rate_limits'::regclass,
      'private.staff_access_audit'::regclass,
      'private.issue_ai_assessments'::regclass,
      'private.issue_risk_overrides'::regclass,
      'private.recurrence_capture_tokens'::regclass,
      'private.recurrence_evidence'::regclass,
      'private.resolution_evidence'::regclass,
      'private.system_job_runs'::regclass,
      'private.staff_issue_access_audit'::regclass,
      'private.issue_metric_validity_events'::regclass
      ,'private.issue_ai_assistance_jobs'::regclass
    ])
      and relrowsecurity
  ),
  23::bigint,
  'RLS is enabled on every CivicPin table'
);

select is(
  (select count(*) from pg_indexes where schemaname = 'public' and indexname in ('issues_map_viewport_idx','issues_map_filters_idx')),
  2::bigint,
  'staff viewport and shared map filters have bounded query indexes'
);

select is(
  (select count(*) from pg_policies where schemaname = 'private'),
  0::bigint,
  'private tables have no client-facing RLS policies'
);

set local role anon;

select is(
  (select count(*) from public.district_public_snapshots),
  13::bigint,
  'anonymous player receives one safe snapshot per Taoyuan district'
);

reset role;

select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'district_public_snapshots'
      and column_name in (
        'issue_id', 'ticket_number', 'title', 'body', 'photo', 'reporter_id',
        'email', 'latitude', 'longitude', 'address', 'created_at', 'admin_note'
      )
  ),
  'public snapshot schema has no individual ticket or exact-location fields'
);

select ok(
  (
    select bool_and(
      administrative_completion_rate is null
      and field_resolution_rate is null
      and hotspots = '[]'::jsonb
    )
    from public.district_public_snapshots
  ),
  'small denominators suppress rates and unpublished hotspots'
);

set local role service_role;
select is(
  public.refresh_public_snapshots_if_due() ->> 'ran',
  'false',
  'snapshot worker is a no-op while the five-minute snapshot is fresh'
);
reset role;

update public.district_public_snapshots set generated_at = now() - interval '2 days';
set local role service_role;
select is(
  format('%s:%s', public.refresh_public_snapshots_if_due() ->> 'success', public.refresh_public_snapshots_if_due() ->> 'ran'),
  'true:false',
  'snapshot worker refreshes stale data once and an immediate retry is idempotent'
);
reset role;

select is(
  (select format('%s:%s', status, output_count) from private.system_job_runs where job_type = 'public_snapshot' order by created_at desc limit 1),
  'succeeded:13',
  'snapshot worker records its output count for operations audit'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in ('issues', 'issue_status_events')
      and cmd = 'SELECT'
  ),
  2::bigint,
  'public ticket tables expose only their two SELECT policies'
);

select ok(
  not has_column_privilege('anon', 'public.issues', 'id', 'SELECT')
    and not has_column_privilege('anon', 'public.issue_status_events', 'id', 'SELECT'),
  'anonymous users cannot read private tickets or events'
);

select ok(
  has_column_privilege('authenticated', 'public.issues', 'id', 'SELECT')
    and has_column_privilege('authenticated', 'public.issue_status_events', 'id', 'SELECT')
    and not has_column_privilege('authenticated', 'public.issue_status_events', 'changed_by', 'SELECT')
    and not has_table_privilege('authenticated', 'public.issues', 'INSERT')
    and not has_table_privilege('authenticated', 'public.issues', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.issues', 'DELETE'),
  'authenticated clients get RLS reads but no actor identity or direct writes'
);

select ok(
  not has_table_privilege('service_role', 'public.issues', 'SELECT')
    and not has_table_privilege('service_role', 'public.issues', 'INSERT')
    and not has_table_privilege('service_role', 'public.issues', 'UPDATE')
    and not has_table_privilege('service_role', 'public.issues', 'DELETE')
    and not has_table_privilege('service_role', 'private.completion_email_outbox', 'SELECT'),
  'service role must use the narrow RPC contract instead of base tables'
);

select ok(
  has_function_privilege('authenticated', 'public.acknowledge_issue(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.start_issue(uuid,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.complete_issue(uuid,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.authorize_issue_photo(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.staff_access_state()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.override_issue_risk(uuid,smallint,text,uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.record_resolution_evidence(uuid,text,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.list_staff_issues(text,text,text,smallint,boolean,text,integer,integer,boolean)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.notification_outbox_summary()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.set_issue_metric_validity(uuid,boolean,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.staff_issue_status_counts()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.list_staff_issue_map(double precision,double precision,double precision,double precision,text,text,text,smallint,boolean,boolean)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.request_issue_ai_assistance(uuid,uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.authorize_resolution_evidence_photo(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.verify_staff_number(uuid,uuid,text,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.provision_staff(uuid,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.record_issue_ai_assessment(uuid,smallint,text[],text[],text[],text,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.create_recurrence_capture_token(uuid,uuid,text,double precision,double precision,double precision,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.submit_recurrence_issue(uuid,uuid,public.issue_category,text,double precision,double precision,text,text,text,integer,integer,integer,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.submit_recurrence_issue(uuid,uuid,public.issue_category,text,double precision,double precision,text,text,text,integer,integer,integer,text,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.submit_recurrence_issue(uuid,uuid,public.issue_category,text,double precision,double precision,text,text,text,integer,integer,integer,text,text,text,text,text,text,text,text)', 'EXECUTE')
    and not has_function_privilege(
      'authenticated',
      'public.submit_issue(uuid,uuid,public.issue_category,text,double precision,double precision,text,text,text,integer,integer,integer)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.submit_issue(uuid,uuid,public.issue_category,text,double precision,double precision,text,text,text,integer,integer,integer,text)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.submit_issue(uuid,uuid,public.issue_category,text,double precision,double precision,text,text,text,integer,integer,integer,text,text,text,text,text,text,text)',
      'EXECUTE'
    )
    and not has_function_privilege('authenticated', 'public.claim_completion_emails(integer,uuid)', 'EXECUTE'),
  'authenticated users can call only user-scoped and staff-checked RPCs'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.submit_issue(uuid,uuid,public.issue_category,text,double precision,double precision,text,text,text,integer,integer,integer)',
    'EXECUTE'
  )
    and has_function_privilege(
      'service_role',
      'public.submit_issue(uuid,uuid,public.issue_category,text,double precision,double precision,text,text,text,integer,integer,integer,text)',
      'EXECUTE'
    )
    and has_function_privilege('service_role', 'public.claim_completion_emails(integer,uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.finish_completion_email(uuid,uuid,boolean,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.consume_admin_auth_rate_limit(text,text,integer,integer,integer)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.verify_staff_number(uuid,uuid,text,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.provision_staff(uuid,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.record_issue_ai_assessment(uuid,smallint,text[],text[],text[],text,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.create_recurrence_capture_token(uuid,uuid,text,double precision,double precision,double precision,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.submit_recurrence_issue(uuid,uuid,public.issue_category,text,double precision,double precision,text,text,text,integer,integer,integer,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.submit_recurrence_issue(uuid,uuid,public.issue_category,text,double precision,double precision,text,text,text,integer,integer,integer,text,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.submit_recurrence_issue(uuid,uuid,public.issue_category,text,double precision,double precision,text,text,text,integer,integer,integer,text,text,text,text,text,text,text,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.submit_issue(uuid,uuid,public.issue_category,text,double precision,double precision,text,text,text,integer,integer,integer,text,text,text,text,text,text,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.refresh_public_snapshots_if_due()', 'EXECUTE')
    and has_function_privilege('service_role', 'public.list_orphaned_issue_photos(integer)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.claim_ai_assessment_retries(integer,uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.finish_ai_assessment_retry(uuid,uuid,boolean,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.claim_ai_assistance_jobs(integer,uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.finish_ai_assistance_job(uuid,uuid,boolean,text,text,text,text,text)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.override_issue_risk(uuid,smallint,text,uuid)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.record_resolution_evidence(uuid,text,text)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.complete_issue(uuid,text)', 'EXECUTE'),
  'service role can submit and drain outbox but cannot impersonate staff transitions'
);

select ok(
  not has_function_privilege('anon', 'public.is_staff()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.acknowledge_issue(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.staff_access_state()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.override_issue_risk(uuid,smallint,text,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.notification_outbox_summary()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.set_issue_metric_validity(uuid,boolean,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.staff_issue_status_counts()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.list_staff_issue_map(double precision,double precision,double precision,double precision,text,text,text,smallint,boolean,boolean)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.request_issue_ai_assistance(uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.create_recurrence_capture_token(uuid,uuid,text,double precision,double precision,double precision,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.authorize_resolution_evidence_photo(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.authorize_issue_photo(uuid)', 'EXECUTE'),
  'anonymous users cannot execute CivicPin RPCs'
);

select is(
  (
    select count(*)
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  ),
  0::bigint,
  'security definer functions stay outside the exposed public schema'
);

select is(
  (
    select count(*)
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.prosecdef
      and not exists (
        select 1
        from unnest(coalesce(p.proconfig, '{}'::text[])) as setting
        where setting ~ '^search_path=(""|)$'
      )
  ),
  0::bigint,
  'every private security definer has an empty search_path'
);

select ok(
  (
    select not public
      and file_size_limit = 10485760
      and allowed_mime_types = array['image/jpeg']::text[]
    from storage.buckets
    where id = 'issue-photos'
  ),
  'issue photos use a private JPEG-only 10 MiB bucket'
);

insert into auth.users(id, email, phone, raw_user_meta_data, email_confirmed_at, phone_confirmed_at, is_anonymous)
values
  ('11111111-1111-4111-8111-111111111111', null, '886911111111', '{}'::jsonb, null, now(), false),
  ('22222222-2222-4222-8222-222222222222', null, '886922222222', '{}'::jsonb, null, now(), false),
  ('33333333-3333-4333-8333-333333333333', 'staff@example.com', null, '{}'::jsonb, now(), null, false),
  ('44444444-4444-4444-8444-444444444444', 'inactive@example.com', null, '{}'::jsonb, now(), null, false),
  ('55555555-5555-4555-8555-555555555555', 'unverified@example.com', null, '{}'::jsonb, null, null, false),
  ('66666666-6666-4666-8666-666666666666', null, '886966666666', '{}'::jsonb, null, now(), false),
  ('77777777-7777-4777-8777-777777777777', null, '886977777777', '{}'::jsonb, null, now(), false);

set local role service_role;

select ok(
  public.provision_staff('33333333-3333-4333-8333-333333333333', 'CP-STAFF-0001'),
  'service role can provision a verified staff account'
);

select ok(
  public.provision_staff('44444444-4444-4444-8444-444444444444', 'CP-STAFF-0002'),
  'service role can provision another verified staff account'
);

reset role;
update private.staff_memberships
set active = false
where user_id = '44444444-4444-4444-8444-444444444444';

select ok(
  (
    select staff_number_hash <> 'CP-STAFF-0001'
      and extensions.crypt('CP-STAFF-0001', staff_number_hash) = staff_number_hash
    from private.staff_memberships
    where user_id = '33333333-3333-4333-8333-333333333333'
  ),
  'staff number is stored only as a verifiable bcrypt hash'
);

insert into auth.sessions(id, user_id, created_at, updated_at, aal, not_after)
values (
  '33333333-3333-4333-8333-000000000001',
  '33333333-3333-4333-8333-333333333333',
  now(),
  now(),
  'aal1',
  null
);

set local role service_role;

select is(
  public.verify_staff_number(
    '33333333-3333-4333-8333-333333333333',
    '33333333-3333-4333-8333-000000000001',
    'CP-WRONG-0001',
    repeat('a', 64)
  ) ->> 'authorized',
  'false',
  'incorrect staff number is rejected'
);

select is(
  public.verify_staff_number(
    '33333333-3333-4333-8333-333333333333',
    '33333333-3333-4333-8333-000000000001',
    'CP-STAFF-0001',
    repeat('a', 64)
  ) ->> 'authorized',
  'true',
  'correct staff number creates a session-scoped grant after email OTP'
);

reset role;

select ok(
  exists (
    select 1 from private.staff_access_sessions
    where session_id = '33333333-3333-4333-8333-000000000001'
      and user_id = '33333333-3333-4333-8333-333333333333'
      and expires_at > now() + interval '6 days'
  ),
  'staff number grant is bound to the live auth session for seven days'
);

set local role service_role;
do $$
begin
  perform public.consume_admin_auth_rate_limit('otp-send-email', repeat('b', 64), 3, 900, 900);
  perform public.consume_admin_auth_rate_limit('otp-send-email', repeat('b', 64), 3, 900, 900);
  perform public.consume_admin_auth_rate_limit('otp-send-email', repeat('b', 64), 3, 900, 900);
end;
$$;

select is(
  public.consume_admin_auth_rate_limit('otp-send-email', repeat('b', 64), 3, 900, 900) ->> 'allowed',
  'false',
  'durable account rate limit locks attempts after the configured threshold'
);

reset role;

insert into storage.objects(bucket_id, name, metadata)
values
  (
    'issue-photos',
    '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.jpg',
    '{"size":1024,"mimetype":"image/jpeg"}'::jsonb
  ),
  (
    'issue-photos',
    '55555555-5555-4555-8555-555555555555/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210.jpg',
    '{"size":1024,"mimetype":"image/jpeg"}'::jsonb
  ),
  (
    'issue-photos',
    '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg',
    '{"size":1024,"mimetype":"image/jpeg"}'::jsonb
  ),
  (
    'issue-photos',
    '22222222-2222-4222-8222-222222222222/cccccccc-cccc-4ccc-8ccc-cccccccccccc/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg',
    '{"size":1024,"mimetype":"image/jpeg"}'::jsonb
  ),
  (
    'issue-photos',
    '66666666-6666-4666-8666-666666666666/66666666-6666-4666-8666-666666666666/6666666666666666666666666666666666666666666666666666666666666666.jpg',
    '{"size":1024,"mimetype":"image/jpeg"}'::jsonb
  ),
  (
    'issue-photos',
    '77777777-7777-4777-8777-777777777777/77777777-7777-4777-8777-777777777777/7777777777777777777777777777777777777777777777777777777777777777.jpg',
    '{"size":1024,"mimetype":"image/jpeg"}'::jsonb
  ),
  (
    'issue-photos',
    '22222222-2222-4222-8222-222222222222/99999999-9999-4999-8999-999999999999/8888888888888888888888888888888888888888888888888888888888888888.jpg',
    '{"size":1024,"mimetype":"image/jpeg"}'::jsonb
  ),
  (
    'issue-photos',
    'orphan/00000000-0000-4000-8000-000000000000/' || repeat('f', 64) || '.jpg',
    '{"size":1024,"mimetype":"image/jpeg"}'::jsonb
  );

update storage.objects set created_at = now() - interval '25 hours' where name like 'orphan/%';

set local role service_role;

select is(
  (select object_path from public.list_orphaned_issue_photos(100) where object_path like 'orphan/%'),
  'orphan/00000000-0000-4000-8000-000000000000/' || repeat('f', 64) || '.jpg',
  'photo janitor lists only unreferenced objects after the 24-hour grace period'
);

select throws_ok(
  $$select * from public.list_orphaned_issue_photos(501)$$,
  '22023',
  'Invalid orphan photo limit',
  'photo janitor enforces a bounded batch size'
);

select is(
  public.submit_issue(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'road_sidewalk',
    'taoyuan',
    24.9937,
    121.301,
    'Broken road report',
    'A dangerous pothole blocks the right lane.',
    '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.jpg',
    1024,
    800,
    600,
    '桃園市桃園區測試路1號',
    '王小明',
    'other',
    '31_40',
    '+886911111111',
    'civic.pin',
    'resident@example.com'
  ) ->> 'created',
  'true',
  'verified server submission creates a ticket'
);

select is(
  public.submit_issue(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'road_sidewalk',
    'taoyuan',
    24.9937,
    121.301,
    'Broken road report',
    'A dangerous pothole blocks the right lane.',
    '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.jpg',
    1024,
    800,
    600,
    '桃園市桃園區測試路1號',
    '王小明',
    'other',
    '31_40',
    '+886911111111',
    'civic.pin',
    'resident@example.com'
  ) ->> 'created',
  'false',
  'same submission key and content is idempotent'
);

select throws_ok(
  $sql$
    select public.submit_issue(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'road_sidewalk', 'taoyuan', 24.9937, 121.301,
      'Broken road report', 'A dangerous pothole blocks the right lane.',
      '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.jpg',
      1024, 800, 600, '桃園市桃園區測試路1號',
      '王小明', 'other', '31_40', '+886911111111', 'changed.line', 'resident@example.com'
    )
  $sql$,
  '23505',
  'Submission key was already used with different contact details',
  'submission retry cannot replace private citizen contact details'
);

reset role;
select is(
  (select address from public.issues where submission_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  '桃園市桃園區測試路1號',
  'server-confirmed address is stored with the complaint'
);
set local role service_role;

select throws_ok(
  $sql$
    select public.submit_issue(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'road_sidewalk',
      'taoyuan',
      24.9937,
      121.301,
      'Different road report',
      'A dangerous pothole blocks the right lane.',
      '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.jpg',
      1024,
      800,
      600
    )
  $sql$,
  '23505',
  'Submission key was already used with different content',
  'same submission key rejects different content'
);

select throws_ok(
  $sql$
    select public.submit_issue(
      '55555555-5555-4555-8555-555555555555',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'waste_pollution',
      'taoyuan',
      24.9937,
      121.301,
      'Unverified report',
      'This report must not become a ticket.',
      '55555555-5555-4555-8555-555555555555/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210.jpg',
      1024,
      800,
      600
    )
  $sql$,
  '42501',
  'Verified email or phone user is required',
  'unverified identity cannot create a ticket'
);

select throws_ok(
  $sql$
    select public.submit_issue(
      '22222222-2222-4222-8222-222222222222',
      '99999999-9999-4999-8999-999999999999',
      'waste_pollution',
      'taoyuan',
      24.9937,
      121.301,
      'Legacy photo path',
      'This report uses an invalid photo filename.',
      '22222222-2222-4222-8222-222222222222/99999999-9999-4999-8999-999999999999/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg',
      1024,
      800,
      600
    )
  $sql$,
  '22023',
  'Photo path does not match the submission',
  'submission accepts only a SHA-256 JPEG filename under its own prefix'
);

reset role;

select ok(
  (select count(*) = 1 from public.issues where reporter_id = '11111111-1111-4111-8111-111111111111')
    and (select count(*) = 1 from private.issue_contacts where reporter_email is null and reporter_phone = '+886911111111')
    and (select count(*) = 1 from private.issue_photos)
    and (select count(*) = 1 from public.issue_status_events where to_status = 'received'),
  'submission commits exactly one ticket, contact, photo, and received event'
);

do $$
begin
  perform set_config(
    'test.civicpin_issue_id',
    (select id::text from public.issues where reporter_id = '11111111-1111-4111-8111-111111111111'),
    true
  );
end;
$$;

set local role service_role;
select public.refresh_public_snapshots();
reset role;

select ok(
  (select ticket_count = 1 and period_end = (now() at time zone 'Asia/Taipei')::date
   from public.district_public_snapshots where district_id = 'taoyuan'),
  'current database tickets are included in the rolling public snapshot'
);

select ok(
  (
    select analysis_status = 'evaluation_required'
      and risk_level is null
      and failure_code = 'provider_unavailable'
      and input_scope = array['title', 'body', 'category']::text[]
    from private.issue_ai_assessments
    where issue_id = (select id from public.issues where reporter_id = '11111111-1111-4111-8111-111111111111')
  ),
  'every new ticket atomically starts with an explicit evaluation-required AI record'
);

set local role service_role;

select is(
  (
    select format('%s:%s:%s', issue_id, category, attempts)
    from public.claim_ai_assessment_retries(1, 'abababab-abab-4bab-8bab-abababababab')
  ),
  current_setting('test.civicpin_issue_id') || ':road_sidewalk:1',
  'AI retry worker claims bounded source fields and increments its attempt'
);

select is(
  (select count(*) from public.claim_ai_assessment_retries(1, 'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc')),
  0::bigint,
  'AI retry lock prevents a concurrent duplicate claim'
);

select is(
  public.finish_ai_assessment_retry(
    current_setting('test.civicpin_issue_id')::uuid,
    'abababab-abab-4bab-8bab-abababababab', false, 'provider_error'
  ),
  true,
  'AI retry failure releases the lock and schedules bounded backoff'
);

reset role;

select ok(
  (
    select retry_attempts = 1 and next_attempt_at > now() and lock_token is null
    from private.issue_ai_assessments where issue_id = current_setting('test.civicpin_issue_id')::uuid
  ) and (select status = 'received' from public.issues where id = current_setting('test.civicpin_issue_id')::uuid),
  'AI retry failure preserves the received ticket and records retry state'
);

set local role service_role;

select is(
  public.record_issue_ai_assessment(
    current_setting('test.civicpin_issue_id')::uuid,
    4::smallint,
    array['accident_risk', 'pedestrian_obstruction'],
    array[]::text[],
    array['title', 'body', 'category'],
    'civic-risk',
    '2026-08'
  ),
  true,
  'service role can record one validated AI assessment'
);

reset role;

select ok(
  (
    select assessment.analysis_status = 'evaluated'
      and assessment.risk_level = 4
      and assessment.risk_reason_codes = array['accident_risk', 'pedestrian_obstruction']::text[]
      and assessment.model = 'civic-risk'
      and issue.status = 'received'
      and issue.visibility = 'private'
    from private.issue_ai_assessments as assessment
    join public.issues as issue on issue.id = assessment.issue_id
    where issue.reporter_id = '11111111-1111-4111-8111-111111111111'
  ),
  'AI assessment preserves the received private ticket state'
);

set local role service_role;

select lives_ok(
  $$select public.record_issue_ai_assessment(
    current_setting('test.civicpin_issue_id')::uuid,
    4::smallint,
    array['accident_risk', 'pedestrian_obstruction'],
    array[]::text[],
    array['title', 'body', 'category'],
    'civic-risk',
    '2026-08'
  )$$,
  'identical AI assessment retry is idempotent'
);

select throws_ok(
  $$select public.record_issue_ai_assessment(
    current_setting('test.civicpin_issue_id')::uuid,
    5::smallint,
    array['immediate_life_risk'],
    array[]::text[],
    array['title', 'body', 'category'],
    'civic-risk',
    '2026-08'
  )$$,
  '23505',
  'AI assessment already recorded',
  'a later provider response cannot replace the original AI result'
);

reset role;

set local "request.jwt.claims" = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*) from public.issues),
  1::bigint,
  'ticket owner can read their ticket through RLS'
);

select is(
  (select count(*) from public.issue_status_events),
  1::bigint,
  'ticket owner can read their status history through RLS'
);

select is(
  public.authorize_issue_photo(current_setting('test.civicpin_issue_id')::uuid),
  '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.jpg',
  'ticket owner can authorize their private photo'
);

select is(
  public.issue_field_status(current_setting('test.civicpin_issue_id')::uuid),
  'active',
  'ticket owner can read the separate active field status'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'issue-photos'),
  0::bigint,
  'ticket ownership does not grant direct Storage object reads'
);

select throws_ok(
  $$update public.issues set title = 'Tampered report' where id = current_setting('test.civicpin_issue_id')::uuid$$,
  '42501',
  'permission denied for table issues',
  'ticket owner cannot update the base table'
);

reset role;
set local "request.jwt.claims" = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*) from public.issues),
  0::bigint,
  'another citizen cannot read a known ticket'
);

select is(
  (select count(*) from public.issue_status_events),
  0::bigint,
  'another citizen cannot read a known ticket history'
);

select throws_ok(
  $$select public.authorize_issue_photo(current_setting('test.civicpin_issue_id')::uuid)$$,
  '42501',
  'Photo is unavailable',
  'another citizen cannot authorize the ticket photo'
);

select throws_ok(
  $$select public.issue_field_status(current_setting('test.civicpin_issue_id')::uuid)$$,
  '42501',
  'Issue is unavailable',
  'another citizen cannot read the ticket field status'
);

select throws_ok(
  $$select public.acknowledge_issue(current_setting('test.civicpin_issue_id')::uuid)$$,
  '42501',
  'Active staff membership is required',
  'non-staff cannot acknowledge a ticket'
);

select throws_ok(
  $$select public.list_staff_issues(null,null,null,null::smallint,false,'latest',50,0)$$,
  '42501',
  'Active staff membership is required',
  'non-staff cannot read the staff issue list'
);

select throws_ok(
  $$select public.list_staff_issue_map(24.8,121.0,25.1,121.5,null,null,null,null::smallint,false)$$,
  '42501',
  'Active staff membership is required',
  'non-staff cannot read viewport ticket pins'
);

select throws_ok(
  $$select public.notification_outbox_summary()$$,
  '42501',
  'Active staff membership is required',
  'non-staff cannot read notification delivery state'
);

select throws_ok(
  $$select public.set_issue_metric_validity(current_setting('test.civicpin_issue_id')::uuid,false,'duplicate')$$,
  '42501',
  'Active staff membership is required',
  'citizen cannot exclude a ticket from public metrics'
);

select throws_ok(
  $$select public.request_issue_ai_assistance(current_setting('test.civicpin_issue_id')::uuid,'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa')$$,
  '42501',
  'Active staff membership is required',
  'citizen cannot create a staff AI assistance job'
);

select throws_ok(
  $$select public.override_issue_risk(
    current_setting('test.civicpin_issue_id')::uuid,
    2::smallint,
    'Citizen cannot change risk.',
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
  )$$,
  '42501',
  'Active staff membership is required',
  'citizen cannot modify the internal risk assessment'
);

select throws_ok(
  $$select public.record_resolution_evidence(
    current_setting('test.civicpin_issue_id')::uuid,
    'resolution/11111111-1111-4111-8111-111111111111/' || repeat('9', 64) || '.jpg',
    'Citizen cannot register a staff inspection record.'
  )$$,
  '42501',
  'Active staff membership is required',
  'citizen cannot register resolution evidence'
);

reset role;
set local "request.jwt.claims" = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal1"}';
set local role authenticated;

select is(public.is_staff(), false, 'inactive membership is not staff authorization');

reset role;
set local "request.jwt.claims" = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}';
set local role authenticated;

select is(public.is_staff(), false, 'email OTP without the staff number session grant cannot authorize staff');

reset role;
set local "request.jwt.claims" = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1","session_id":"33333333-3333-4333-8333-000000000001"}';
set local role authenticated;

select is(public.is_staff(), true, 'active membership, email OTP and session staff number grant authorize staff');

select is(
  public.staff_access_state() ->> 'authorized',
  'true',
  'staff access state reports the fully authorized current session'
);

select is(
  (select count(*) from public.issues),
  1::bigint,
  'staff can read all tickets through RLS'
);

select is(
  public.staff_issue_status_counts() ->> 'received',
  '1',
  'staff status summary counts current tickets without loading their coordinates'
);

select is(
  public.list_staff_issue_map(24.8,121.0,25.1,121.5,null,null,null,null::smallint,false) ->> 'total',
  '1',
  'staff map query returns tickets inside the current viewport'
);

select is(
  public.list_staff_issue_map(25.1,121.0,25.2,121.5,null,null,null,null::smallint,false) ->> 'total',
  '0',
  'staff map query excludes tickets outside the current viewport'
);

select is(
  public.authorize_issue_photo(current_setting('test.civicpin_issue_id')::uuid),
  '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.jpg',
  'staff can authorize a private ticket photo'
);

select throws_ok(
  $$select public.start_issue(current_setting('test.civicpin_issue_id')::uuid, 'road_maintenance')$$,
  '22023',
  'Issue must be viewed before processing',
  'staff cannot skip the viewed transition'
);

select is(
  (
    select format(
      '%s:%s:%s:%s:%s:%s:%s:%s:%s:%s',
      detail -> 'issue' ->> 'status',
      jsonb_array_length(detail -> 'events'),
      detail -> 'risk' ->> 'effectiveLevel',
      detail -> 'risk' ->> 'source',
      detail -> 'contact' ->> 'realName',
      detail -> 'contact' ->> 'gender',
      detail -> 'contact' ->> 'ageGroup',
      detail -> 'contact' ->> 'cellPhone',
      detail -> 'contact' ->> 'lineId',
      detail -> 'contact' ->> 'contactEmail'
    )
    from (
      select public.acknowledge_issue(current_setting('test.civicpin_issue_id')::uuid) as detail
    ) as result
  ),
  'viewed:2:4:ai:王小明:other:31_40:+886911111111:civic.pin:resident@example.com',
  'acknowledgement returns status, AI risk, and private citizen contact details'
);

select is(
  (select status::text from public.issues where id = current_setting('test.civicpin_issue_id')::uuid),
  'viewed',
  'acknowledgement moves the ticket to viewed'
);

select lives_ok(
  $$select public.acknowledge_issue(current_setting('test.civicpin_issue_id')::uuid)$$,
  'acknowledgement retry is idempotent'
);

reset role;

select is(
  (select count(*) from private.staff_issue_access_audit where issue_id = current_setting('test.civicpin_issue_id')::uuid),
  2::bigint,
  'every successful staff detail read is retained in the access audit'
);

set local "request.jwt.claims" = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1","session_id":"33333333-3333-4333-8333-000000000001"}';
set local role authenticated;

select throws_ok(
  $$select public.override_issue_risk(
    current_setting('test.civicpin_issue_id')::uuid,
    5::smallint,
    'short',
    'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa'
  )$$,
  '22023',
  'Risk level and change reason are required',
  'staff risk override requires a meaningful reason'
);

select is(
  (
    select format(
      '%s:%s:%s',
      detail -> 'risk' ->> 'effectiveLevel',
      detail -> 'risk' ->> 'source',
      jsonb_array_length(detail -> 'risk' -> 'history')
    )
    from (
      select public.override_issue_risk(
        current_setting('test.civicpin_issue_id')::uuid,
        5::smallint,
        'Immediate traffic danger confirmed from the submitted evidence.',
        'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa'
      ) as detail
    ) as changed
  ),
  '5:manager:1',
  'staff can override risk with a reason and receives the effective result'
);

reset role;

select ok(
  (select risk_level = 4 from private.issue_ai_assessments where issue_id = current_setting('test.civicpin_issue_id')::uuid)
    and (
      select from_level = 4 and to_level = 5 and changed_by = '33333333-3333-4333-8333-333333333333'
      from private.issue_risk_overrides
      where issue_id = current_setting('test.civicpin_issue_id')::uuid
    ),
  'manager override preserves the original AI result and append-only actor history'
);

set local "request.jwt.claims" = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1","session_id":"33333333-3333-4333-8333-000000000001"}';
set local role authenticated;

select lives_ok(
  $$select public.override_issue_risk(
    current_setting('test.civicpin_issue_id')::uuid,
    5::smallint,
    'Immediate traffic danger confirmed from the submitted evidence.',
    'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa'
  )$$,
  'identical manager risk retry is idempotent'
);

select is(
  format('%s:%s:%s',
    public.list_staff_issues(null,null,null,5::smallint,false,'risk',50,0) ->> 'total',
    public.list_staff_issues(null,null,null,5::smallint,false,'risk',50,0) -> 'items' -> 0 ->> 'effective_risk',
    public.list_staff_issues(null,null,null,5::smallint,false,'risk',50,0) -> 'items' -> 0 ->> 'recurrence_count'
  ),
  '1:5:0',
  'staff list returns actual effective risk and recurrence values with server filters'
);

select throws_ok(
  $$select public.list_staff_issues(null,null,null,null::smallint,false,'latest',51,0)$$,
  '22023',
  'Invalid staff issue list query',
  'staff list enforces the server page-size ceiling'
);

reset role;

select is(
  (select count(*) from private.issue_risk_overrides where issue_id = current_setting('test.civicpin_issue_id')::uuid),
  1::bigint,
  'manager risk retry does not duplicate the audit history'
);

set local "request.jwt.claims" = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1","session_id":"33333333-3333-4333-8333-000000000001"}';
set local role authenticated;

select throws_ok(
  $$select public.override_issue_risk(
    current_setting('test.civicpin_issue_id')::uuid,
    3::smallint,
    'A conflicting retry must not replace the first risk decision.',
    'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa'
  )$$,
  '23505',
  'Risk change key was already used',
  'risk change key cannot report success for different content'
);

select is(
  (
    select count(*)
    from public.issue_status_events
    where issue_id = current_setting('test.civicpin_issue_id')::uuid and to_status = 'viewed'
  ),
  1::bigint,
  'acknowledgement retry does not duplicate the viewed event'
);

select throws_ok(
  $$select public.complete_issue(
    current_setting('test.civicpin_issue_id')::uuid,
    'This answer must not skip the processing state.'
  )$$,
  '22023',
  'Issue must be in progress before completion',
  'staff cannot skip the in-progress transition'
);

select is(
  (
    select format(
      '%s:%s',
      detail -> 'issue' ->> 'status',
      jsonb_array_length(detail -> 'events')
    )
    from (
      select public.start_issue(
        current_setting('test.civicpin_issue_id')::uuid,
        'road_maintenance'
      ) as detail
    ) as result
  ),
  'in_progress:3',
  'start returns the new status and three-event history'
);

select ok(
  (
    select status = 'in_progress' and assigned_department = 'road_maintenance'
    from public.issues
    where id = current_setting('test.civicpin_issue_id')::uuid
  ),
  'start transition stores status and department together'
);

select lives_ok(
  $$select public.start_issue(current_setting('test.civicpin_issue_id')::uuid, 'road_maintenance')$$,
  'identical start retry is idempotent'
);

reset role;
insert into public.issues(
  id,ticket_number,reporter_id,submission_key,category,district_id,latitude,longitude,title,body,status,
  metric_valid,metric_exclusion_reason
) values (
  'dddddddd-3333-4333-8333-dddddddddddd','CP-AI-ASSIST-TEMP',
  '11111111-1111-4111-8111-111111111111','eeeeeeee-3333-4333-8333-eeeeeeeeeeee',
  'road_sidewalk','taoyuan',24.99,121.30,'Temporary AI test','Temporary viewed issue for AI transition.',
  'viewed',false,'test'
);
set local "request.jwt.claims" = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1","session_id":"33333333-3333-4333-8333-000000000001"}';
set local role authenticated;

select is(
  public.request_issue_ai_assistance(
    'dddddddd-3333-4333-8333-dddddddddddd','ffffffff-3333-4333-8333-ffffffffffff'
  ) ->> 'status',
  'pending',
  'a viewed ticket can start only after its retryable AI assistance job is stored'
);

select is(
  (select status::text from public.issues where id = 'dddddddd-3333-4333-8333-dddddddddddd'),
  'in_progress',
  'stored staff AI work moves a viewed ticket to in progress in the same transaction'
);

reset role;
delete from private.issue_ai_assistance_jobs where issue_id = 'dddddddd-3333-4333-8333-dddddddddddd';
delete from public.issue_status_events where issue_id = 'dddddddd-3333-4333-8333-dddddddddddd';
delete from private.issue_problem_spots where issue_id = 'dddddddd-3333-4333-8333-dddddddddddd';
delete from private.problem_spots where origin_issue_id = 'dddddddd-3333-4333-8333-dddddddddddd';
delete from public.issues where id = 'dddddddd-3333-4333-8333-dddddddddddd';
set local "request.jwt.claims" = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1","session_id":"33333333-3333-4333-8333-000000000001"}';
set local role authenticated;

select is(
  public.request_issue_ai_assistance(
    current_setting('test.civicpin_issue_id')::uuid,
    'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa'
  ) ->> 'status',
  'pending',
  'staff can store a retryable AI summary and answer-draft job'
);

select lives_ok(
  $$select public.request_issue_ai_assistance(
    current_setting('test.civicpin_issue_id')::uuid,
    'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa'
  )$$,
  'AI assistance request key is idempotent'
);

reset role;
do $$ begin
  perform set_config(
    'test.civicpin_ai_assistance_job_id',
    (select id::text from private.issue_ai_assistance_jobs where issue_id = current_setting('test.civicpin_issue_id')::uuid),
    true
  );
end; $$;
select is(
  (select count(*) from private.issue_ai_assistance_jobs where issue_id = current_setting('test.civicpin_issue_id')::uuid),
  1::bigint,
  'AI assistance request retry keeps one durable job'
);

set local role service_role;
select is(
  (select count(*) from public.claim_ai_assistance_jobs(1,'bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb')),
  1::bigint,
  'AI assistance worker claims a due job'
);

select is(
  (select count(*) from public.claim_ai_assistance_jobs(1,'cccccccc-3333-4333-8333-cccccccccccc')),
  0::bigint,
  'AI assistance lock prevents duplicate worker claims'
);

select is(
  public.finish_ai_assistance_job(
    current_setting('test.civicpin_ai_assistance_job_id')::uuid,
    'bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb', true,
    'The road issue blocks pedestrians.',
    'The department is reviewing the obstruction and will update you.',
    'civic-assist', '2026-08', null
  ),
  true,
  'AI worker stores validated summary and answer draft without finalizing the issue'
);

reset role;
set local "request.jwt.claims" = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1","session_id":"33333333-3333-4333-8333-000000000001"}';
set local role authenticated;

select is(
  public.acknowledge_issue(current_setting('test.civicpin_issue_id')::uuid) -> 'aiAssistance' ->> 'status',
  'succeeded',
  'staff detail exposes the stored AI assistance result for human review'
);

select throws_ok(
  $$select public.start_issue(current_setting('test.civicpin_issue_id')::uuid, 'traffic_safety')$$,
  '23505',
  'Issue was already started with a different department',
  'start retry cannot report success for a different department'
);

select throws_ok(
  $$select public.hold_issue(
    current_setting('test.civicpin_issue_id')::uuid,
    'Too short',
    now() + interval '1 day'
  )$$,
  '22023',
  'Hold reason and future review time are required',
  'hold requires a meaningful reason'
);

select is(
  (
    select format(
      '%s:%s:%s',
      detail -> 'issue' ->> 'status',
      jsonb_array_length(detail -> 'events'),
      detail -> 'events' -> 3 ->> 'holdReason'
    )
    from (
      select public.hold_issue(
        current_setting('test.civicpin_issue_id')::uuid,
        'Waiting for replacement paving materials.',
        '2099-01-01T00:00:00Z'
      ) as detail
    ) as result
  ),
  'on_hold:4:Waiting for replacement paving materials.',
  'hold stores its reason and next event'
);

select lives_ok(
  $$select public.hold_issue(
    current_setting('test.civicpin_issue_id')::uuid,
    'Waiting for replacement paving materials.',
    '2099-01-01T00:00:00Z'
  )$$,
  'identical hold retry is idempotent'
);

select is(
  public.notification_outbox_summary() ->> 'pending',
  '1',
  'staff can see pending notification delivery state'
);

reset role;

select ok(
  (
    select email_type = 'on_hold' and event.hold_reason = 'Waiting for replacement paving materials.'
      and event.next_check_at = '2099-01-01T00:00:00Z'
    from private.completion_email_outbox as outbox
    join public.issue_status_events as event on event.id = outbox.status_event_id
    where outbox.issue_id = current_setting('test.civicpin_issue_id')::uuid and outbox.email_type = 'on_hold'
  ),
  'hold event atomically creates an email job with its reason and review time'
);

update private.completion_email_outbox set sent_at = now()
where issue_id = current_setting('test.civicpin_issue_id')::uuid and email_type = 'on_hold';

set local "request.jwt.claims" = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1","session_id":"33333333-3333-4333-8333-000000000001"}';
set local role authenticated;

select throws_ok(
  $$select public.complete_issue(
    current_setting('test.civicpin_issue_id')::uuid,
    'This answer must not complete a held issue.'
  )$$,
  '22023',
  'Issue must be in progress before completion',
  'held issue cannot complete directly'
);

select is(
  (
    select format(
      '%s:%s',
      detail -> 'issue' ->> 'status',
      jsonb_array_length(detail -> 'events')
    )
    from (
      select public.resume_issue(current_setting('test.civicpin_issue_id')::uuid) as detail
    ) as result
  ),
  'in_progress:5',
  'resume returns the issue to processing with preserved history'
);

select is(
  (
    select format(
      '%s:%s',
      detail -> 'issue' ->> 'status',
      jsonb_array_length(detail -> 'events')
    )
    from (
      select public.complete_issue(
        current_setting('test.civicpin_issue_id')::uuid,
        'Repairs have been completed and the road is open.'
      ) as detail
    ) as result
  ),
  'completed:6',
  'completion returns the new status and six-event history'
);

select lives_ok(
  $$select public.complete_issue(
    current_setting('test.civicpin_issue_id')::uuid,
    'Repairs have been completed and the road is open.'
  )$$,
  'identical completion retry is idempotent'
);

select throws_ok(
  $$select public.complete_issue(
    current_setting('test.civicpin_issue_id')::uuid,
    'A different final answer must not replace the first.'
  )$$,
  '23505',
  'Issue was already completed with a different answer',
  'completion retry cannot replace the final answer'
);

reset role;

select ok(
  (
    select status = 'completed'
    from public.issues
    where id = current_setting('test.civicpin_issue_id')::uuid
  )
    and (select count(*) = 6 from public.issue_status_events where issue_id = current_setting('test.civicpin_issue_id')::uuid)
    and (select count(*) = 1 from private.completion_email_outbox where issue_id = current_setting('test.civicpin_issue_id')::uuid and email_type = 'completed'),
  'completion commits the final state, full event history, and one outbox job'
);

select is(
  (
    select spot.field_status::text
    from private.issue_problem_spots as link
    join private.problem_spots as spot on spot.id = link.problem_spot_id
    where link.issue_id = current_setting('test.civicpin_issue_id')::uuid
  ),
  'verification_pending',
  'administrative completion leaves field resolution pending'
);

set local role service_role;

select is(
  public.submit_issue(
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'road_sidewalk',
    'taoyuan',
    24.99371,
    121.30101,
    'Road damage happened again',
    'The repaired road is damaged again at the same location.',
    '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg',
    1024,
    800,
    600
  ) ->> 'created',
  'true',
  'a nearby recurrence is still created as a new ticket'
);

reset role;

select is(
  (
    select spot.field_status::text
    from private.issue_problem_spots as link
    join private.problem_spots as spot on spot.id = link.problem_spot_id
    join public.issues as issue on issue.id = link.issue_id
    where issue.reporter_id = '22222222-2222-4222-8222-222222222222'
  ),
  'active',
  'a new unresolved report reactivates its grouped spot without confirming recurrence'
);

select is(
  (
    select candidate.status::text
    from private.recurrence_candidates as candidate
    join public.issues as issue on issue.id = candidate.issue_id
    where issue.reporter_id = '22222222-2222-4222-8222-222222222222'
  ),
  'pending',
  'nearby completed issue creates a private recurrence candidate'
);

do $$
begin
  perform set_config(
    'test.civicpin_general_recurrence_issue_id',
    (select issue.id::text
      from private.recurrence_candidates as candidate
      join public.issues as issue on issue.id = candidate.issue_id
      where issue.reporter_id = '22222222-2222-4222-8222-222222222222'),
    true
  );
end;
$$;

set local "request.jwt.claims" = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1","session_id":"33333333-3333-4333-8333-000000000001"}';
set local role authenticated;

select throws_ok(
  $$select public.review_recurrence(issue.id, true)
    from public.issues as issue
    where issue.reporter_id = '22222222-2222-4222-8222-222222222222'$$,
  '22023',
  'Verified recurrence evidence is required',
  'location and category match alone cannot confirm a recurrence'
);

reset role;
update public.issues
set status = 'completed'
where id = current_setting('test.civicpin_general_recurrence_issue_id')::uuid;
set local role service_role;

select throws_ok(
  $$select public.create_recurrence_capture_token(
    '22222222-2222-4222-8222-222222222222',
    current_setting('test.civicpin_issue_id')::uuid, repeat('9', 64),
    24.99371, 121.30101, 12, repeat('d', 64)
  )$$,
  '42501',
  'Completed source issue is unavailable',
  'a citizen cannot start recurrence capture from another citizen ticket'
);

select ok(
  public.create_recurrence_capture_token(
    '22222222-2222-4222-8222-222222222222',
    current_setting('test.civicpin_general_recurrence_issue_id')::uuid, repeat('c', 64),
    24.99371, 121.30101, 12, repeat('d', 64)
  ) > now(),
  'verified citizen receives a five-minute server capture token'
);

select throws_ok(
  $$select public.submit_recurrence_issue(
    '22222222-2222-4222-8222-222222222222',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'road_sidewalk', 'taoyuan', 24.99410, 121.30101,
    'Changed recurrence location', 'The submitted coordinates do not match the approved capture location.',
    'unused.jpg', 1024, 800, 600, repeat('c', 64)
  )$$,
  '22023',
  'Recurrence capture location changed',
  'submission cannot replace the server-approved capture location'
);

select is(
  public.submit_recurrence_issue(
    '22222222-2222-4222-8222-222222222222',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'road_sidewalk',
    'taoyuan',
    24.99372,
    121.30102,
    'Fresh camera evidence of road damage',
    'A new camera photo shows the road failed again at this location.',
    '22222222-2222-4222-8222-222222222222/cccccccc-cccc-4ccc-8ccc-cccccccccccc/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg',
    1024,
    800,
    600,
    repeat('c', 64),
    '桃園市桃園區再發路2號',
    '陳小華',
    'female',
    '21_30',
    '+886922222222',
    null,
    null
  ) ->> 'recurrenceEvidence',
  'true',
  'fresh camera token creates a separate recurrence evidence ticket'
);

reset role;
select is(
  (select address from public.issues where submission_key = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  '桃園市桃園區再發路2號',
  'recurrence submission stores its server-confirmed address'
);

select ok(
  (
    select evidence.pin_distance_meters <= 500
      and token.source_issue_id = current_setting('test.civicpin_general_recurrence_issue_id')::uuid
      and token.source_distance_meters <= 500
      and token.consumed_issue_id = evidence.issue_id
      and candidate.evidence_eligible
      and candidate.status = 'pending'
    from private.recurrence_evidence as evidence
    join private.recurrence_capture_tokens as token on token.token_hash = evidence.token_hash
    join private.recurrence_candidates as candidate on candidate.issue_id = evidence.issue_id
    where token.token_hash = repeat('c', 64)
  ),
  'server stores one-use, five-minute and 500m evidence facts without exposing a prior ticket'
);

do $$
begin
  perform set_config(
    'test.civicpin_recurrence_issue_id',
    (select issue_id::text from private.recurrence_evidence where token_hash = repeat('c', 64)),
    true
  );
end;
$$;

set local role service_role;

select is(
  public.submit_recurrence_issue(
    '22222222-2222-4222-8222-222222222222',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'road_sidewalk', 'taoyuan', 24.99372, 121.30102,
    'Fresh camera evidence of road damage',
    'A new camera photo shows the road failed again at this location.',
    '22222222-2222-4222-8222-222222222222/cccccccc-cccc-4ccc-8ccc-cccccccccccc/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg',
    1024, 800, 600, repeat('c', 64), '桃園市桃園區再發路2號',
    '陳小華', 'female', '21_30', '+886922222222', null, null
  ) ->> 'created',
  'false',
  'same token and submission retry is idempotent'
);

select throws_ok(
  $$select public.submit_recurrence_issue(
    '22222222-2222-4222-8222-222222222222',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'road_sidewalk', 'taoyuan', 24.99372, 121.30102,
    'Different recurrence submission', 'This must not reuse a consumed capture token.',
    'unused.jpg', 1024, 800, 600, repeat('c', 64)
  )$$,
  '23505',
  'Recurrence capture token was already used',
  'capture token cannot be reused for another ticket'
);

select throws_ok(
  $$select
  public.create_recurrence_capture_token(
    '22222222-2222-4222-8222-222222222222',
    current_setting('test.civicpin_general_recurrence_issue_id')::uuid, repeat('e', 64),
    24.85, 121.10, 20, repeat('d', 64)
  )$$,
  '22023',
  'Current location is too far from the source issue',
  'current location farther than 500m is rejected before camera access'
);

reset role;
select is(
  (select count(*) from private.recurrence_capture_tokens where token_hash = repeat('e', 64)),
  0::bigint,
  'a rejected location cannot leave a reusable camera token'
);

set local role service_role;
do $$
begin
  perform public.create_recurrence_capture_token(
    '22222222-2222-4222-8222-222222222222',
    current_setting('test.civicpin_general_recurrence_issue_id')::uuid, repeat('a', 64),
    24.99371, 121.30101, 10, repeat('d', 64)
  );
end;
$$;

reset role;
update private.recurrence_capture_tokens
set created_at = now() - interval '10 minutes', expires_at = now() - interval '5 minutes'
where token_hash = repeat('a', 64);
set local role service_role;

select throws_ok(
  $$select public.submit_recurrence_issue(
    '22222222-2222-4222-8222-222222222222',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'road_sidewalk', 'taoyuan', 24.99372, 121.30102,
    'Expired recurrence evidence', 'This capture token is older than five minutes.',
    'unused.jpg', 1024, 800, 600, repeat('a', 64)
  )$$,
  '22023',
  'Recurrence capture token expired',
  'capture token expires five minutes after the server starts capture'
);

do $$
declare
  digit text;
begin
  foreach digit in array array['1','2','3','4','5'] loop
    perform public.create_recurrence_capture_token(
      '11111111-1111-4111-8111-111111111111',
      current_setting('test.civicpin_issue_id')::uuid, repeat(digit, 64),
      24.9937, 121.301, 10, repeat('f', 64)
    );
  end loop;
end;
$$;

select throws_ok(
  $$select public.create_recurrence_capture_token(
    '11111111-1111-4111-8111-111111111111',
    current_setting('test.civicpin_issue_id')::uuid, repeat('6', 64),
    24.9937, 121.301, 10, repeat('f', 64)
  )$$,
  'P0001',
  'Recurrence capture rate limit exceeded',
  'capture token issuance is durably rate limited per citizen'
);

reset role;
set local "request.jwt.claims" = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1","session_id":"33333333-3333-4333-8333-000000000001"}';
set local role authenticated;

select is(
  (
    select detail -> 'field' ->> 'status'
    from (
      select public.review_recurrence(
        current_setting('test.civicpin_recurrence_issue_id')::uuid,
        true
      ) as detail
    ) as reviewed
  ),
  'recurrence_confirmed',
  'staff approval confirms recurrence on the shared problem spot'
);

reset role;

-- Reuse the completed fixture as each citizen's owned source ticket without
-- adding setup-only reports that would alter the problem-spot count.
update public.issues set reporter_id = '66666666-6666-4666-8666-666666666666'
where id = current_setting('test.civicpin_issue_id')::uuid;
set local role service_role;
do $$ begin
  perform public.create_recurrence_capture_token(
    '66666666-6666-4666-8666-666666666666',
    current_setting('test.civicpin_issue_id')::uuid, repeat('7', 64),
    24.99371, 121.30101, 10, repeat('7', 64)
  );
  perform public.submit_recurrence_issue(
    '66666666-6666-4666-8666-666666666666',
    '66666666-6666-4666-8666-666666666666',
    'road_sidewalk', 'taoyuan', 24.99372, 121.30102,
    'Another verified road recurrence', 'A second citizen captured the same road damage again.',
    '66666666-6666-4666-8666-666666666666/66666666-6666-4666-8666-666666666666/6666666666666666666666666666666666666666666666666666666666666666.jpg',
    1024, 800, 600, repeat('7', 64)
  );
end; $$;

reset role;
update public.issues set reporter_id = '77777777-7777-4777-8777-777777777777'
where id = current_setting('test.civicpin_issue_id')::uuid;
set local role service_role;
do $$ begin
  perform public.create_recurrence_capture_token(
    '77777777-7777-4777-8777-777777777777',
    current_setting('test.civicpin_issue_id')::uuid, repeat('8', 64),
    24.99371, 121.30101, 10, repeat('8', 64)
  );
  perform public.submit_recurrence_issue(
    '77777777-7777-4777-8777-777777777777',
    '77777777-7777-4777-8777-777777777777',
    'road_sidewalk', 'taoyuan', 24.99372, 121.30102,
    'Third verified road recurrence', 'A third citizen captured the same road damage again.',
    '77777777-7777-4777-8777-777777777777/77777777-7777-4777-8777-777777777777/7777777777777777777777777777777777777777777777777777777777777777.jpg',
    1024, 800, 600, repeat('8', 64)
  );
end $$;

reset role;
update public.issues set reporter_id = '11111111-1111-4111-8111-111111111111'
where id = current_setting('test.civicpin_issue_id')::uuid;
set local role service_role;
do $$ begin
  perform public.create_recurrence_capture_token(
    '22222222-2222-4222-8222-222222222222',
    current_setting('test.civicpin_general_recurrence_issue_id')::uuid, repeat('b', 64),
    24.99371, 121.30101, 10, repeat('b', 64)
  );
  perform public.submit_recurrence_issue(
    '22222222-2222-4222-8222-222222222222',
    '99999999-9999-4999-8999-999999999999',
    'road_sidewalk', 'taoyuan', 24.99372, 121.30102,
    'Repeated report from same citizen', 'This repeat must not inflate the urgency count within one day.',
    '22222222-2222-4222-8222-222222222222/99999999-9999-4999-8999-999999999999/8888888888888888888888888888888888888888888888888888888888888888.jpg',
    1024, 800, 600, repeat('b', 64)
  );
end;
$$;

reset role;
update public.issues
set status = 'received'
where id = current_setting('test.civicpin_general_recurrence_issue_id')::uuid;
set local "request.jwt.claims" = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1","session_id":"33333333-3333-4333-8333-000000000001"}';
set local role authenticated;

do $$
begin
  perform public.review_recurrence(
    (select id from public.issues where reporter_id = '66666666-6666-4666-8666-666666666666'), true
  );
  perform public.review_recurrence(
    (select id from public.issues where reporter_id = '77777777-7777-4777-8777-777777777777'), true
  );
  perform public.review_recurrence(
    (select id from public.issues where submission_key = '99999999-9999-4999-8999-999999999999'), true
  );
end;
$$;

reset role;

select ok(
  (
    select count(*) = 3 and count(distinct issue.reporter_id) = 3
    from private.recurrence_candidates as candidate
    join public.issues as issue on issue.id = candidate.issue_id
    where candidate.candidate_problem_spot_id = (
      select problem_spot_id from private.issue_problem_spots
      where issue_id = current_setting('test.civicpin_issue_id')::uuid
    )
      and candidate.status = 'approved'
      and candidate.counts_for_urgency
  ),
  'three verified recurrences from at least two citizens mark the spot urgent'
);

select ok(
  (
    select not counts_for_urgency
    from private.recurrence_candidates
    where issue_id = (
      select id from public.issues where submission_key = '99999999-9999-4999-8999-999999999999'
    )
  ),
  'same citizen recurrence within 24 hours does not inflate urgency'
);

select is(
  (
    select format('%s:%s', count(distinct link.problem_spot_id), count(*))
    from private.issue_problem_spots as link
    join public.issues as issue on issue.id = link.issue_id
    where issue.category = 'road_sidewalk'
  ),
  '1:6',
  'nearby reports in the same category share one problem spot without losing individual tickets'
);

set local "request.jwt.claims" = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1","session_id":"33333333-3333-4333-8333-000000000001"}';
set local role authenticated;

select is(
  format('%s:%s:%s',
    public.list_staff_issues(null,'road_sidewalk','taoyuan',null::smallint,false,'latest',50,0,true) ->> 'total',
    public.list_staff_issues(null,'road_sidewalk','taoyuan',null::smallint,false,'latest',50,0,true) -> 'items' -> 0 ->> 'issue_count',
    public.list_staff_issues(null,'road_sidewalk','taoyuan',null::smallint,false,'latest',50,0,true) -> 'items' -> 0 ->> 'problem_spot'
  ),
  '6:6:true',
  'five or more valid reports are returned through the staff problem-spot filter'
);

reset role;

insert into storage.objects(bucket_id, name, metadata)
values (
  'issue-photos',
  'resolution/' || current_setting('test.civicpin_general_recurrence_issue_id') || '/' || repeat('9', 64) || '.jpg',
  '{"size":1024,"mimetype":"image/jpeg"}'::jsonb
);

set local "request.jwt.claims" = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1","session_id":"33333333-3333-4333-8333-000000000001"}';
set local role authenticated;

do $$
begin
  perform public.acknowledge_issue(current_setting('test.civicpin_general_recurrence_issue_id')::uuid);
  perform public.start_issue(current_setting('test.civicpin_general_recurrence_issue_id')::uuid, 'road_maintenance');
end;
$$;

select is(
  public.record_resolution_evidence(
    current_setting('test.civicpin_general_recurrence_issue_id')::uuid,
    'resolution/' || current_setting('test.civicpin_general_recurrence_issue_id') || '/' || repeat('9', 64) || '.jpg',
    'Staff inspected the repaired road and photographed the safe surface.'
  ) -> 'field' ->> 'status',
  'resolved_confirmed',
  'staff photo and inspection record confirm field resolution'
);

select is(
  public.authorize_resolution_evidence_photo(
    current_setting('test.civicpin_general_recurrence_issue_id')::uuid
  ),
  'resolution/' || current_setting('test.civicpin_general_recurrence_issue_id') || '/' || repeat('9', 64) || '.jpg',
  'staff can authorize the private resolution photo'
);

select lives_ok(
  $$select public.record_resolution_evidence(
    current_setting('test.civicpin_general_recurrence_issue_id')::uuid,
    'resolution/' || current_setting('test.civicpin_general_recurrence_issue_id') || '/' || repeat('9', 64) || '.jpg',
    'Staff inspected the repaired road and photographed the safe surface.'
  )$$,
  'identical resolution evidence retry is idempotent'
);

select throws_ok(
  $$select public.record_resolution_evidence(
    current_setting('test.civicpin_general_recurrence_issue_id')::uuid,
    'resolution/' || current_setting('test.civicpin_general_recurrence_issue_id') || '/' || repeat('9', 64) || '.jpg',
    'A different inspection must not replace the original evidence.'
  )$$,
  '23505',
  'Resolution evidence already recorded',
  'resolution evidence is append-only and cannot be replaced'
);

reset role;

select ok(
  (select status = 'in_progress' from public.issues where id = current_setting('test.civicpin_general_recurrence_issue_id')::uuid)
    and (
      select evidence.changed_by = '33333333-3333-4333-8333-333333333333'
        and event.to_status = 'resolved_confirmed' and event.reason = 'staff_evidence'
      from private.resolution_evidence as evidence
      join private.issue_problem_spots as link on link.issue_id = evidence.issue_id
      join private.field_status_events as event
        on event.issue_id = evidence.issue_id and event.problem_spot_id = link.problem_spot_id
      where evidence.issue_id = current_setting('test.civicpin_general_recurrence_issue_id')::uuid
        and event.reason = 'staff_evidence'
    ),
  'resolution evidence stores actor and field event without changing administrative state'
);

set local "request.jwt.claims" = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
set local role authenticated;

select is(
  public.authorize_resolution_evidence_photo(
    current_setting('test.civicpin_general_recurrence_issue_id')::uuid
  ),
  'resolution/' || current_setting('test.civicpin_general_recurrence_issue_id') || '/' || repeat('9', 64) || '.jpg',
  'ticket owner can authorize their private resolution photo'
);

reset role;
set local "request.jwt.claims" = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
set local role authenticated;

select throws_ok(
  $$select public.authorize_resolution_evidence_photo(
    current_setting('test.civicpin_general_recurrence_issue_id')::uuid
  )$$,
  '42501',
  'Photo is unavailable',
  'another citizen cannot authorize the private resolution photo'
);

reset role;

select ok(
  (select status = 'completed' from public.issues where reporter_id = '11111111-1111-4111-8111-111111111111')
    and (select status = 'received' from public.issues where id = current_setting('test.civicpin_recurrence_issue_id')::uuid)
    and (select status = 'in_progress' from public.issues where id = current_setting('test.civicpin_general_recurrence_issue_id')::uuid)
    and (
      select count(distinct problem_spot_id) = 1
      from private.issue_problem_spots
      where issue_id in (
        current_setting('test.civicpin_issue_id')::uuid,
        current_setting('test.civicpin_recurrence_issue_id')::uuid
      )
    ),
  'recurrence preserves the completed original and links the new received ticket'
);

select ok(
  (
    select outbox.status_event_id = event.id
      and outbox.recipient_email = 'resident@example.com'
      and outbox.ticket_number = issue.ticket_number
      and event.final_answer = 'Repairs have been completed and the road is open.'
    from private.completion_email_outbox as outbox
    join public.issue_status_events as event on event.id = outbox.status_event_id
    join public.issues as issue on issue.id = outbox.issue_id
    where outbox.issue_id = current_setting('test.civicpin_issue_id')::uuid and outbox.email_type = 'completed'
  ),
  'outbox references the one completion event and verified contact snapshot'
);

do $$
begin
  perform set_config(
    'test.civicpin_outbox_id',
    (select id::text from private.completion_email_outbox where issue_id = current_setting('test.civicpin_issue_id')::uuid and email_type = 'completed'),
    true
  );
end;
$$;

set local role service_role;

select throws_ok(
  $$select * from public.claim_completion_emails(null, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')$$,
  '22023',
  'Invalid email claim',
  'null outbox claim limit is rejected instead of claiming every row'
);

select is(
  (
    select count(*)
    from public.claim_completion_emails(1, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
    where event_at is not null and email_type = 'completed'
  ),
  1::bigint,
  'worker claims one due completion with its completion time'
);

select is(
  (select count(*) from public.claim_completion_emails(1, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')),
  0::bigint,
  'an active outbox lock prevents a second claim'
);

select is(
  public.finish_completion_email(
    current_setting('test.civicpin_outbox_id')::uuid,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    true
  ),
  false,
  'worker cannot finish a job with another lock token'
);

select throws_ok(
  $$select public.finish_completion_email(
    current_setting('test.civicpin_outbox_id')::uuid,
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    null
  )$$,
  '22023',
  'Invalid email completion',
  'worker must explicitly report delivery success or failure'
);

select is(
  public.finish_completion_email(
    current_setting('test.civicpin_outbox_id')::uuid,
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    false,
    'temporary failure'
  ),
  true,
  'failed delivery releases its lock for retry'
);

reset role;

select ok(
  (
    select attempts = 1
      and lock_token is null
      and locked_at is null
      and sent_at is null
      and next_attempt_at > now()
      and last_error = 'temporary failure'
    from private.completion_email_outbox
    where id = current_setting('test.civicpin_outbox_id')::uuid
  ),
  'failed delivery records bounded retry state without changing ticket completion'
);

update private.completion_email_outbox
set next_attempt_at = now()
where id = current_setting('test.civicpin_outbox_id')::uuid;

set local role service_role;

select is(
  (select count(*) from public.claim_completion_emails(1, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')),
  1::bigint,
  'a due failed delivery can be claimed again'
);

select is(
  public.finish_completion_email(
    current_setting('test.civicpin_outbox_id')::uuid,
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    true
  ),
  true,
  'matching worker lock can mark the email sent'
);

select is(
  (select count(*) from public.claim_completion_emails(1, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')),
  0::bigint,
  'sent email cannot be claimed again'
);

reset role;

select ok(
  (
    select attempts = 2
      and sent_at is not null
      and lock_token is null
      and locked_at is null
      and last_error is null
    from private.completion_email_outbox
    where id = current_setting('test.civicpin_outbox_id')::uuid
  ),
  'successful retry leaves one terminal sent outbox row'
);

set local role service_role;
select public.refresh_public_snapshots();
reset role;
select set_config(
  'test.civicpin_taoyuan_count_before_exclusion',
  (select ticket_count::text from public.district_public_snapshots where district_id = 'taoyuan'),
  true
);

set local "request.jwt.claims" = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1","session_id":"33333333-3333-4333-8333-000000000001"}';
set local role authenticated;

select is(
  public.set_issue_metric_validity(current_setting('test.civicpin_issue_id')::uuid,false,'duplicate') -> 'issue' ->> 'metric_exclusion_reason',
  'duplicate',
  'staff can exclude a duplicate with an audited reason'
);

reset role;
update public.issues set created_at = now() - interval '1 day'
where id = current_setting('test.civicpin_issue_id')::uuid;
update public.district_public_snapshots set generated_at = now() - interval '2 days';
set local role service_role;
select public.refresh_public_snapshots_if_due();
reset role;

select ok(
  (select ticket_count = current_setting('test.civicpin_taoyuan_count_before_exclusion')::integer - 1
   from public.district_public_snapshots where district_id = 'taoyuan')
    and (select reason = 'duplicate' and not to_valid from private.issue_metric_validity_events where issue_id = current_setting('test.civicpin_issue_id')::uuid),
  'excluded duplicate is absent from the next public snapshot and keeps its audit event'
);

select * from finish();
rollback;
