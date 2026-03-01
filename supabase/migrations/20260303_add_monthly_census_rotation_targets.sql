alter table public.resident_monthly_census
  add column if not exists rotation text,
  add column if not exists dictation_met boolean,
  add column if not exists ct_mri_target_met boolean,
  add column if not exists msk_pedia_target_met boolean,
  add column if not exists comments text;

update public.resident_monthly_census
set
  rotation = coalesce(rotation, 'General Radiology'),
  dictation_met = coalesce(dictation_met, false),
  ct_mri_target_met = coalesce(ct_mri_target_met, false),
  comments = coalesce(comments, null)
where rotation is null
   or dictation_met is null
   or ct_mri_target_met is null;

alter table public.resident_monthly_census
  alter column rotation set default 'General Radiology',
  alter column rotation set not null,
  alter column dictation_met set default false,
  alter column dictation_met set not null,
  alter column ct_mri_target_met set default false,
  alter column ct_mri_target_met set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'resident_monthly_census_rotation_check'
  ) then
    alter table public.resident_monthly_census
      add constraint resident_monthly_census_rotation_check
      check (
        rotation in (
          'General Radiology',
          'CT/MRI',
          'Pedia/MSK',
          'Ultrasound',
          'Interventional Radiology',
          'Mandaue CT/MRI',
          'Mandaue Oncology',
          'Breast/Women''s'
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'resident_monthly_census_msk_pedia_target_check'
  ) then
    alter table public.resident_monthly_census
      add constraint resident_monthly_census_msk_pedia_target_check
      check (
        (rotation = 'Pedia/MSK' and msk_pedia_target_met is not null)
        or (rotation <> 'Pedia/MSK' and msk_pedia_target_met is null)
      );
  end if;
end
$$;
