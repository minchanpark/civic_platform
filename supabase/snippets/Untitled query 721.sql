select public.provision_staff(
    (select id
     from auth.users
     where lower(email) = lower('admin@example.com')),
    'CP-ADMIN-REPLACE'
  );
