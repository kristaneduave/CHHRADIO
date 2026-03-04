alter table public.resident_endorsements
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists is_pinned boolean not null default false,
  add column if not exists pinned_at timestamptz;

create index if not exists idx_resident_endorsements_pin_created
  on public.resident_endorsements (is_pinned desc, created_at desc);

insert into storage.buckets (id, name, public)
values ('resident-endorsement-files', 'resident-endorsement-files', true)
on conflict (id) do nothing;

drop policy if exists "resident_endorsement_files_select" on storage.objects;
create policy "resident_endorsement_files_select"
  on storage.objects for select
  using (
    bucket_id = 'resident-endorsement-files'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'moderator', 'resident')
    )
  );

drop policy if exists "resident_endorsement_files_insert" on storage.objects;
create policy "resident_endorsement_files_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'resident-endorsement-files'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'moderator', 'resident')
    )
  );

drop policy if exists "resident_endorsement_files_update" on storage.objects;
create policy "resident_endorsement_files_update"
  on storage.objects for update
  using (
    bucket_id = 'resident-endorsement-files'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'moderator', 'resident')
    )
  )
  with check (
    bucket_id = 'resident-endorsement-files'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'moderator', 'resident')
    )
  );

drop policy if exists "resident_endorsement_files_delete" on storage.objects;
create policy "resident_endorsement_files_delete"
  on storage.objects for delete
  using (
    bucket_id = 'resident-endorsement-files'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'moderator', 'resident')
    )
  );
