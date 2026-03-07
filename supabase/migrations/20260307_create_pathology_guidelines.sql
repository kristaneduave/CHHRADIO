create table if not exists public.pathology_guidelines (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  pathology_name text not null,
  specialty text null,
  synonyms text[] not null default '{}',
  keywords text[] not null default '{}',
  google_drive_url text not null,
  google_drive_file_id text not null,
  source_title text null,
  issuing_body text null,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  updated_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pathology_guidelines_slug_check check (length(trim(slug)) > 0),
  constraint pathology_guidelines_name_check check (length(trim(pathology_name)) > 0)
);

create table if not exists public.pathology_guideline_versions (
  id uuid primary key default gen_random_uuid(),
  guideline_id uuid not null references public.pathology_guidelines(id) on delete cascade,
  version_label text null,
  effective_date date null,
  sync_status text not null check (sync_status in ('draft', 'published', 'failed')),
  source_revision text null,
  source_title text null,
  issuing_body text null,
  source_url text not null,
  rich_summary_md text not null default '',
  checklist_items jsonb not null default '[]'::jsonb,
  parse_notes text null,
  raw_text_excerpt text null,
  synced_at timestamptz not null default now(),
  synced_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  published_at timestamptz null,
  published_by uuid null references public.profiles(id) on delete set null
);

create index if not exists idx_pathology_guidelines_active_name
  on public.pathology_guidelines (is_active, pathology_name);

create index if not exists idx_pathology_guideline_versions_guideline_synced
  on public.pathology_guideline_versions (guideline_id, synced_at desc);

create index if not exists idx_pathology_guideline_versions_guideline_status
  on public.pathology_guideline_versions (guideline_id, sync_status, published_at desc nulls last);

create or replace function public.set_pathology_guidelines_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_set_pathology_guidelines_updated_at on public.pathology_guidelines;
create trigger trg_set_pathology_guidelines_updated_at
before update on public.pathology_guidelines
for each row execute function public.set_pathology_guidelines_updated_at();

create or replace function public.current_user_is_pathology_guideline_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace view public.pathology_guideline_current as
select
  g.id as guideline_id,
  g.slug,
  g.pathology_name,
  g.specialty,
  g.synonyms,
  g.keywords,
  g.google_drive_url,
  v.id as version_id,
  v.version_label,
  v.effective_date,
  coalesce(v.source_title, g.source_title) as source_title,
  coalesce(v.issuing_body, g.issuing_body) as issuing_body,
  v.source_url,
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

alter table public.pathology_guidelines enable row level security;
alter table public.pathology_guideline_versions enable row level security;

drop policy if exists "pathology_guidelines_select_authenticated" on public.pathology_guidelines;
create policy "pathology_guidelines_select_authenticated"
on public.pathology_guidelines
for select
to authenticated
using (true);

drop policy if exists "pathology_guidelines_insert_admin" on public.pathology_guidelines;
create policy "pathology_guidelines_insert_admin"
on public.pathology_guidelines
for insert
to authenticated
with check (
  created_by = auth.uid()
  and updated_by = auth.uid()
  and public.current_user_is_pathology_guideline_admin()
);

drop policy if exists "pathology_guidelines_update_admin" on public.pathology_guidelines;
create policy "pathology_guidelines_update_admin"
on public.pathology_guidelines
for update
to authenticated
using (public.current_user_is_pathology_guideline_admin())
with check (public.current_user_is_pathology_guideline_admin());

drop policy if exists "pathology_guideline_versions_select_authenticated" on public.pathology_guideline_versions;
create policy "pathology_guideline_versions_select_authenticated"
on public.pathology_guideline_versions
for select
to authenticated
using (
  sync_status = 'published'
  or public.current_user_is_pathology_guideline_admin()
);

drop policy if exists "pathology_guideline_versions_insert_admin" on public.pathology_guideline_versions;
create policy "pathology_guideline_versions_insert_admin"
on public.pathology_guideline_versions
for insert
to authenticated
with check (
  synced_by = auth.uid()
  and public.current_user_is_pathology_guideline_admin()
);

drop policy if exists "pathology_guideline_versions_update_admin" on public.pathology_guideline_versions;
create policy "pathology_guideline_versions_update_admin"
on public.pathology_guideline_versions
for update
to authenticated
using (public.current_user_is_pathology_guideline_admin())
with check (
  public.current_user_is_pathology_guideline_admin()
);

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
      and p.role = 'admin'
  ) then
    raise exception 'Admin role required';
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
