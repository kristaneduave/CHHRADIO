drop policy if exists "resident_endorsements_insert_resident_own" on public.resident_endorsements;
create policy "resident_endorsements_insert_resident_or_admin_own"
on public.resident_endorsements
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('resident', 'admin')
  )
);

drop policy if exists "resident_endorsement_comments_insert_resident_own" on public.resident_endorsement_comments;
create policy "resident_endorsement_comments_insert_resident_or_admin_own"
on public.resident_endorsement_comments
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('resident', 'admin')
  )
);
