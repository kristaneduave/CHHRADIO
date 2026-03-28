alter table public.consultant_decking_entries
  add column if not exists study_date date,
  add column if not exists study_time time without time zone,
  add column if not exists study_description text;

alter table public.consultant_decking_entries
  drop constraint if exists consultant_decking_entries_study_description_check;

alter table public.consultant_decking_entries
  add constraint consultant_decking_entries_study_description_check
  check (study_description is null or length(trim(study_description)) > 0);
