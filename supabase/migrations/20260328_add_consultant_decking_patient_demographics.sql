alter table public.consultant_decking_entries
  add column if not exists patient_age integer,
  add column if not exists patient_sex text;

alter table public.consultant_decking_entries
  drop constraint if exists consultant_decking_entries_patient_age_check;

alter table public.consultant_decking_entries
  add constraint consultant_decking_entries_patient_age_check
  check (patient_age is null or patient_age > 0);

alter table public.consultant_decking_entries
  drop constraint if exists consultant_decking_entries_patient_sex_check;

alter table public.consultant_decking_entries
  add constraint consultant_decking_entries_patient_sex_check
  check (patient_sex is null or patient_sex in ('M', 'F'));
