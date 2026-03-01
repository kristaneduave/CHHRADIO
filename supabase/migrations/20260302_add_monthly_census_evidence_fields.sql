alter table public.resident_monthly_census
  add column if not exists fuente_ct_evidence_url text,
  add column if not exists fuente_mri_evidence_url text,
  add column if not exists fuente_xray_evidence_url text,
  add column if not exists mandaue_ct_evidence_url text,
  add column if not exists mandaue_mri_evidence_url text,
  add column if not exists attendance_evidence_url text;

insert into storage.buckets (id, name, public)
values ('resident-census-evidence', 'resident-census-evidence', true)
on conflict (id) do nothing;

drop policy if exists "resident_census_evidence_select" on storage.objects;
create policy "resident_census_evidence_select"
  on storage.objects for select
  using (
    bucket_id = 'resident-census-evidence'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role in ('admin', 'moderator', 'training_officer')
      )
    )
  );

drop policy if exists "resident_census_evidence_insert" on storage.objects;
create policy "resident_census_evidence_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'resident-census-evidence'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role in ('admin', 'moderator', 'training_officer')
      )
    )
  );

drop policy if exists "resident_census_evidence_update" on storage.objects;
create policy "resident_census_evidence_update"
  on storage.objects for update
  using (
    bucket_id = 'resident-census-evidence'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role in ('admin', 'moderator', 'training_officer')
      )
    )
  )
  with check (
    bucket_id = 'resident-census-evidence'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role in ('admin', 'moderator', 'training_officer')
      )
    )
  );

drop policy if exists "resident_census_evidence_delete" on storage.objects;
create policy "resident_census_evidence_delete"
  on storage.objects for delete
  using (
    bucket_id = 'resident-census-evidence'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role in ('admin', 'moderator', 'training_officer')
      )
    )
  );
