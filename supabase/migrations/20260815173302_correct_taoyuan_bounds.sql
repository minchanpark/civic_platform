alter table public.issues
  drop constraint issues_latitude_check,
  drop constraint issues_longitude_check,
  add constraint issues_latitude_check check (latitude between 24.589 and 25.124),
  add constraint issues_longitude_check check (longitude between 120.966 and 121.477);
