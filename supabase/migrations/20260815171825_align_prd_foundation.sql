alter type public.issue_category rename value 'road_damage' to 'road_sidewalk';
alter type public.issue_category rename value 'waste_environment' to 'waste_pollution';
alter type public.issue_category rename value 'public_facility' to 'park_facility';
alter type public.issue_status add value if not exists 'on_hold' after 'in_progress';

do $$
begin
  if exists (
    select 1 from public.issues
    where category::text in ('traffic_safety', 'other')
  ) then
    raise exception 'Legacy CivicPin categories must be reclassified before applying the PRD 2.0 migration';
  end if;
end;
$$;

alter table public.issues
  drop constraint issues_district_id_check,
  add constraint issues_district_id_check check (district_id in (
    'taoyuan', 'zhongli', 'pingzhen', 'bade', 'yangmei', 'daxi', 'luzhu',
    'dayuan', 'guishan', 'longtan', 'xinwu', 'guanyin', 'fuxing'
  )),
  add constraint issues_supported_category_check check (
    category::text in ('road_sidewalk', 'waste_pollution', 'park_facility')
  );

notify pgrst, 'reload schema';
