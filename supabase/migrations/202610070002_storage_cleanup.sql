begin;

-- Storage files were never deleted, so deleted cases, replaced avatars and retried uploads kept
-- using the Free plan's 1 GB. A file is only safe to delete when no database row links to it,
-- and some tables were created in the dashboard, so every text, array and JSON column in the
-- public schema is searched rather than a fixed list.

-- Same decoding rules as internal_attachment_path. Returns null for malformed input.
create or replace function public.storage_percent_decode(value text)
returns text language plpgsql immutable set search_path = public as $$
declare
  bytes bytea := ''::bytea; i integer := 1;
begin
  if strpos(value, '%') = 0 then return value; end if;
  while i <= length(value) loop
    if substr(value,i,1) = '%' then
      if substr(value,i+1,2) !~ '^[0-9A-Fa-f]{2}$' then return null; end if;
      bytes := bytes || decode(substr(value,i+1,2),'hex'); i := i + 3;
    else bytes := bytes || convert_to(substr(value,i,1),'UTF8'); i := i + 1; end if;
  end loop;
  return convert_from(bytes,'UTF8');
exception when others then return null;
end;
$$;

-- The app stores public object URLs and storage://bucket/path references. Signed URLs end at
-- '?'. Extra candidates (decoded, trailing punctuation removed) can only keep more files.
create or replace function public.storage_keys_in_text(value text)
returns table(ref_bucket text, ref_name text) language sql immutable set search_path = public as $$
  select distinct m[1], v.name
  from regexp_matches(value,
    '(?:/storage/v1/(?:object|render/image)/(?:public|sign|authenticated)/|storage://)([A-Za-z0-9][A-Za-z0-9_.-]*)/([^\s"<>\\{}|^`?#]+)',
    'g') m
  cross join lateral (values (m[2]), (regexp_replace(m[2], '[.,;:!)'']+$', ''))) p(path)
  cross join lateral (values (p.path), (public.storage_percent_decode(p.path))) v(name)
  where v.name is not null and v.name <> '';
$$;

create or replace function public.storage_object_references()
returns table(ref_bucket text, ref_name text)
language plpgsql stable security definer set search_path = public as $$
declare
  col record; source text;
begin
  for col in
    select c.relname table_name, a.attname column_name, format_type(a.atttypid, null) type_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r'
      and a.atttypid in ('text'::regtype, 'character varying'::regtype, 'json'::regtype, 'jsonb'::regtype,
        'text[]'::regtype, 'character varying[]'::regtype)
  loop
    source := case
      when col.type_name in ('text[]', 'character varying[]') then format(
        'select u.value::text from public.%I t cross join lateral unnest(t.%I) u(value) where strpos(t.%I::text, %L) > 0',
        col.table_name, col.column_name, col.column_name, 'storage')
      when col.type_name in ('json', 'jsonb') then format(
        'select j.value #>> %L from public.%I t cross join lateral jsonb_path_query(t.%I::jsonb, %L) j(value)
         where strpos(t.%I::text, %L) > 0 and jsonb_typeof(j.value) = %L',
        '{}', col.table_name, col.column_name, 'strict $.**', col.column_name, 'storage', 'string')
      else format('select t.%I::text from public.%I t where strpos(t.%I::text, %L) > 0',
        col.column_name, col.table_name, col.column_name, 'storage')
    end;
    return query execute format(
      'select distinct k.ref_bucket, k.ref_name from (%s) s(value) cross join lateral public.storage_keys_in_text(s.value) k',
      source);
  end loop;
end;
$$;

-- Operator report for scripts/storage-cleanup.mjs. Recent files are skipped because an upload
-- is saved to Storage a moment before the row that links to it.
create or replace function public.storage_cleanup_inventory(p_min_age_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
begin
  if p_min_age_days is null or p_min_age_days < 1 then
    raise exception 'Minimum age must be at least 1 day.' using errcode = '22023';
  end if;
  with refs as materialized (
    select distinct ref_bucket, ref_name from public.storage_object_references()
  ), objects as (
    select o.bucket_id, o.name, o.created_at,
      coalesce(case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint end, 0) bytes,
      r.ref_name is null and o.created_at < now() - make_interval(days => p_min_age_days)
        and o.name !~ '(^|/)\.emptyFolderPlaceholder$' unused
    from storage.objects o
    left join refs r on r.ref_bucket = o.bucket_id and r.ref_name = o.name
  )
  select jsonb_build_object(
    'buckets', coalesce((
      select jsonb_agg(jsonb_build_object('bucket', b.bucket_id, 'objects', b.objects, 'bytes', b.bytes,
        'unused_objects', b.unused_objects, 'unused_bytes', b.unused_bytes) order by b.bucket_id)
      from (
        select bucket_id, count(*) objects, sum(bytes) bytes,
          count(*) filter (where unused) unused_objects, coalesce(sum(bytes) filter (where unused), 0) unused_bytes
        from objects group by bucket_id
      ) b), '[]'::jsonb),
    'unused', coalesce((
      select jsonb_agg(jsonb_build_object('bucket', bucket_id, 'name', name, 'bytes', bytes, 'created_at', created_at)
        order by bucket_id, created_at)
      from objects where unused), '[]'::jsonb))
  into result;
  return result;
end;
$$;

-- Called by the app right after a case is deleted. Returns the caller's own case images that
-- exist and that nothing else links to, such as a Live Aunt Minnie prompt built from the case.
create or replace function public.releasable_case_images(p_references text[])
returns text[] language plpgsql stable security definer set search_path = public as $$
declare
  owner_folder text := auth.uid()::text;
  requested text[];
  result text[];
begin
  if owner_folder is null then raise exception 'Sign in required.' using errcode = '42501'; end if;
  if coalesce(cardinality(p_references), 0) > 20 then
    raise exception 'Too many image references.' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct o.name), '{}') into requested
  from unnest(coalesce(p_references, '{}')) r(value)
  cross join lateral public.storage_keys_in_text(r.value) k
  join storage.objects o on o.bucket_id = k.ref_bucket and o.name = k.ref_name
  where k.ref_bucket = 'case-images' and split_part(k.ref_name, '/', 1) = owner_folder;
  if cardinality(requested) = 0 then return requested; end if;
  select coalesce(array_agg(n.name order by n.name), '{}') into result
  from unnest(requested) n(name)
  where not exists (
    select 1 from public.storage_object_references() r
    where r.ref_bucket = 'case-images' and r.ref_name = n.name
  );
  return result;
end;
$$;

revoke all on function public.storage_percent_decode(text) from public, anon, authenticated;
revoke all on function public.storage_keys_in_text(text) from public, anon, authenticated;
revoke all on function public.storage_object_references() from public, anon, authenticated;
revoke all on function public.storage_cleanup_inventory(integer) from public, anon, authenticated;
revoke all on function public.releasable_case_images(text[]) from public, anon;
grant execute on function public.storage_cleanup_inventory(integer) to service_role;
grant execute on function public.releasable_case_images(text[]) to authenticated;

-- Case images are saved under the uploader's id. Storage needs select as well as delete to
-- remove a file.
drop policy if exists case_images_owner_select on storage.objects;
create policy case_images_owner_select on storage.objects for select to authenticated
using (bucket_id = 'case-images' and split_part(name, '/', 1) = auth.uid()::text);
drop policy if exists case_images_owner_delete on storage.objects;
create policy case_images_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'case-images' and split_part(name, '/', 1) = auth.uid()::text);

commit;
