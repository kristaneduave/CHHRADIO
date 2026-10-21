begin;

-- Archiving a case saves its PDF export in the department Google Drive and then removes the case's
-- images from Storage to free space. api/case-archive.ts holds the Drive credentials and uploads the
-- PDF; these functions decide who may archive a case and which images are safe to remove.
-- Requires 202610070002_storage_cleanup.sql (storage_keys_in_text, storage_object_references).

alter table public.cases
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists archive_drive_file_id text,
  add column if not exists archive_size_bytes bigint;

-- Owners can archive their own cases and admins any case. Locks the row so two archive attempts
-- for the same case cannot both succeed.
create or replace function public.case_archive_target(p_case_id uuid)
returns public.cases language plpgsql security definer set search_path = public as $$
declare
  target public.cases;
begin
  if auth.uid() is null then raise exception 'Sign in required.' using errcode = '42501'; end if;
  select * into target from public.cases where id = p_case_id for update;
  if not found or (target.created_by is distinct from auth.uid() and not public.is_admin()) then
    raise exception 'Case not found.' using errcode = 'P0002';
  end if;
  if target.archived_at is not null then
    raise exception 'This case is already archived.' using errcode = '22023';
  end if;
  if coalesce(cardinality(target.image_urls), 0) = 0 and coalesce(btrim(target.image_url), '') = '' then
    raise exception 'This case has no images to archive.' using errcode = '22023';
  end if;
  return target;
end;
$$;

-- Checked before the PDF is uploaded to Drive. Returns the title used for the file name.
create or replace function public.prepare_case_archive(p_case_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  target public.cases;
begin
  target := public.case_archive_target(p_case_id);
  return jsonb_build_object('title', target.title);
end;
$$;

-- Called once the PDF is safely in Drive. Unlinks the images from the case and returns the
-- case-images files that nothing else links to any more, such as a quiz built from the case.
-- A null Drive file means an admin saved the PDF and uploaded it to Drive by hand.
create or replace function public.complete_case_archive(p_case_id uuid, p_drive_file_id text, p_size_bytes bigint)
returns text[] language plpgsql security definer set search_path = public as $$
declare
  target public.cases;
  old_refs text[];
  result text[];
begin
  if p_drive_file_id is not null and p_drive_file_id !~ '^[A-Za-z0-9_-]{10,200}$' then
    raise exception 'Invalid Drive file.' using errcode = '22023';
  end if;
  if p_size_bytes is not null and p_size_bytes < 1 then
    raise exception 'Invalid file size.' using errcode = '22023';
  end if;
  if p_drive_file_id is null and not public.is_admin() then
    raise exception 'Only admins can archive cases uploaded to Drive by hand.' using errcode = '42501';
  end if;
  target := public.case_archive_target(p_case_id);
  old_refs := array_remove(coalesce(target.image_urls, '{}') || target.image_url, null);

  update public.cases set
    image_url = null,
    image_urls = '{}',
    archived_at = now(),
    archived_by = auth.uid(),
    archive_drive_file_id = p_drive_file_id,
    archive_size_bytes = p_size_bytes
  where id = p_case_id;

  with refs as materialized (
    select ref_bucket, ref_name from public.storage_object_references() where ref_bucket = 'case-images'
  )
  select coalesce(array_agg(distinct o.name order by o.name), '{}') into result
  from unnest(old_refs) r(value)
  cross join lateral public.storage_keys_in_text(r.value) k
  join storage.objects o on o.bucket_id = k.ref_bucket and o.name = k.ref_name
  where k.ref_bucket = 'case-images'
    and not exists (select 1 from refs where refs.ref_name = o.name);
  return result;
end;
$$;

-- Admin list of cases that still have images, largest first. Bytes count every image the case
-- links to, including any that a quiz also uses and that archiving would therefore keep.
create or replace function public.case_archive_candidates()
returns table(case_id uuid, title text, created_at timestamptz, owner_name text, image_count integer, bytes bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  return query
  with links as (
    select distinct c.id, k.ref_name
    from public.cases c
    cross join lateral unnest(coalesce(c.image_urls, '{}') || c.image_url) u(value)
    cross join lateral public.storage_keys_in_text(u.value) k
    where c.archived_at is null and u.value is not null and k.ref_bucket = 'case-images'
  ), sizes as (
    select l.id, count(distinct o.name)::integer image_count,
      coalesce(sum(case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint end), 0)::bigint bytes
    from links l
    join storage.objects o on o.bucket_id = 'case-images' and o.name = l.ref_name
    group by l.id
  )
  select c.id, c.title, c.created_at, coalesce(nullif(p.nickname, ''), p.full_name, '')::text, s.image_count, s.bytes
  from sizes s
  join public.cases c on c.id = s.id
  left join public.profiles p on p.id = c.created_by
  order by s.bytes desc, c.created_at;
end;
$$;

revoke all on function public.case_archive_target(uuid) from public, anon, authenticated;
revoke all on function public.prepare_case_archive(uuid) from public, anon;
revoke all on function public.complete_case_archive(uuid, text, bigint) from public, anon;
revoke all on function public.case_archive_candidates() from public, anon;
grant execute on function public.prepare_case_archive(uuid) to authenticated;
grant execute on function public.complete_case_archive(uuid, text, bigint) to authenticated;
grant execute on function public.case_archive_candidates() to authenticated;

-- Admins archive other people's cases, so they also need to remove those images.
drop policy if exists case_images_admin_select on storage.objects;
create policy case_images_admin_select on storage.objects for select to authenticated
using (bucket_id = 'case-images' and public.is_admin());
drop policy if exists case_images_admin_delete on storage.objects;
create policy case_images_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'case-images' and public.is_admin());

commit;
