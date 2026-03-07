alter table public.pathology_guidelines
  add column if not exists source_url text;

alter table public.pathology_guidelines
  add column if not exists source_kind text not null default 'google_drive'
  check (source_kind in ('google_drive', 'pdf', 'external'));

update public.pathology_guidelines
set source_url = coalesce(nullif(source_url, ''), google_drive_url)
where source_url is null or source_url = '';

create or replace function public.current_user_can_edit_pathology_guidelines()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  );
$$;

drop view if exists public.pathology_guideline_current;
create or replace view public.pathology_guideline_current as
select
  g.id as guideline_id,
  g.slug,
  g.pathology_name,
  g.specialty,
  g.synonyms,
  g.keywords,
  g.source_kind,
  coalesce(v.source_url, g.source_url, g.google_drive_url) as source_url,
  g.google_drive_url,
  v.id as version_id,
  v.version_label,
  v.effective_date,
  coalesce(v.source_title, g.source_title) as source_title,
  coalesce(v.issuing_body, g.issuing_body) as issuing_body,
  v.rich_summary_md,
  v.checklist_items,
  v.parse_notes,
  v.raw_text_excerpt,
  v.synced_at,
  v.published_at
from public.pathology_guidelines g
join lateral (
  select pv.*
  from public.pathology_guideline_versions pv
  where pv.guideline_id = g.id
    and pv.sync_status = 'published'
  order by pv.effective_date desc nulls last, pv.published_at desc nulls last, pv.synced_at desc
  limit 1
) v on true
where g.is_active = true;

drop policy if exists "pathology_guidelines_insert_admin" on public.pathology_guidelines;
create policy "pathology_guidelines_insert_admin"
on public.pathology_guidelines
for insert
to authenticated
with check (
  created_by = auth.uid()
  and updated_by = auth.uid()
  and public.current_user_can_edit_pathology_guidelines()
);

drop policy if exists "pathology_guidelines_update_admin" on public.pathology_guidelines;
create policy "pathology_guidelines_update_admin"
on public.pathology_guidelines
for update
to authenticated
using (public.current_user_can_edit_pathology_guidelines())
with check (public.current_user_can_edit_pathology_guidelines());

drop policy if exists "pathology_guideline_versions_select_authenticated" on public.pathology_guideline_versions;
create policy "pathology_guideline_versions_select_authenticated"
on public.pathology_guideline_versions
for select
to authenticated
using (
  sync_status = 'published'
  or public.current_user_can_edit_pathology_guidelines()
);

drop policy if exists "pathology_guideline_versions_insert_admin" on public.pathology_guideline_versions;
create policy "pathology_guideline_versions_insert_admin"
on public.pathology_guideline_versions
for insert
to authenticated
with check (
  synced_by = auth.uid()
  and public.current_user_can_edit_pathology_guidelines()
);

drop policy if exists "pathology_guideline_versions_update_admin" on public.pathology_guideline_versions;
create policy "pathology_guideline_versions_update_admin"
on public.pathology_guideline_versions
for update
to authenticated
using (public.current_user_can_edit_pathology_guidelines())
with check (public.current_user_can_edit_pathology_guidelines());

create or replace function public.publish_pathology_guideline_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guideline_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and p.role in ('admin', 'moderator', 'training_officer')
  ) then
    raise exception 'Privileged role required';
  end if;

  select guideline_id
  into v_guideline_id
  from public.pathology_guideline_versions
  where id = p_version_id;

  if v_guideline_id is null then
    raise exception 'Guideline version not found';
  end if;

  update public.pathology_guideline_versions
  set sync_status = 'draft',
      published_at = null,
      published_by = null
  where guideline_id = v_guideline_id
    and sync_status = 'published'
    and id <> p_version_id;

  update public.pathology_guideline_versions
  set sync_status = 'published',
      published_at = now(),
      published_by = v_uid
  where id = p_version_id;
end;
$$;

grant select on public.pathology_guideline_current to authenticated;
grant execute on function public.publish_pathology_guideline_version(uuid) to authenticated;
