select public.provision_staff(
    (select id
     from auth.users
     where lower(email) = lower('itisnewdawn@gmail.com')),
    'CP-MANAGER-0001'
  );