-- READ ONLY. Export results to a protected, untracked operator directory.
-- No patient narratives, image bytes, credentials, or full share tokens are selected.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname;
select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema in ('public','storage') and grantee in ('anon','authenticated','service_role') order by table_name,grantee;
select p.proname,p.prosecdef,p.proconfig,p.proacl,pg_get_functiondef(p.oid) definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f' order by p.proname;
select pg_get_triggerdef(t.oid) definition from pg_trigger t
join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal;
select id,public,file_size_limit,allowed_mime_types from storage.buckets order by id;
select bucket_id,metadata->>'mimetype' mime_type,count(*) object_count,
  max(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint end) max_bytes
from storage.objects where bucket_id in ('case-images','resident-endorsement-files','resident-census-evidence')
group by bucket_id,metadata->>'mimetype';
select md5(name) object_reference_hash,metadata->>'mimetype' mime_type,metadata->>'size' bytes
from storage.objects where bucket_id='case-images' and (
  coalesce(metadata->>'mimetype','') not in ('image/png','image/jpeg','image/webp','image/gif','image/avif')
  or case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint > 20971520 else true end
);
select version,name from supabase_migrations.schema_migrations order by version;
-- psql project_origin is provided by scripts/security-baseline.mjs. No image URL is printed.
with image_refs as (
  select c.id, r.url from public.cases c
  cross join lateral unnest(coalesce(c.image_urls,array[]::text[]) || array[c.image_url]) r(url)
  where r.url is not null and r.url <> ''
)
select id case_record_id,md5(url) image_reference_hash,'unsupported_image_location' problem
from image_refs where not starts_with(url, :'project_origin' || '/storage/v1/object/public/case-images/')
  or url ~ '[?#]';
-- After the additive inventory helper migration, separately run:
-- select * from public.internal_attachment_inventory('https://YOUR_PROJECT.supabase.co');
-- Any problem blocks cutover. The helper also checks that each reference maps to an existing object.
