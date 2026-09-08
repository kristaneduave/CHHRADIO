begin;
-- These helpers are deliberately not exposed to API roles. Cutover is performed
-- by the database operator only after compatible readers and backups are verified.
create or replace function public.internal_attachment_path(reference text, bucket text, project_origin text)
returns text language plpgsql immutable set search_path = public as $$
declare
  encoded text; result text; bytes bytea := ''::bytea; i integer := 1; prefix text;
begin
  if project_origin !~ '^https://[a-z0-9-]+\.supabase\.co$' then return null; end if;
  prefix := 'storage://' || bucket || '/';
  if starts_with(reference,prefix) then encoded := substr(reference,length(prefix)+1);
  else
    prefix := project_origin || '/storage/v1/object/public/' || bucket || '/';
    if not starts_with(reference,prefix) then return null; end if;
    encoded := substr(reference,length(prefix)+1);
  end if;
  if encoded is null or encoded = '' or encoded ~ '[?#]' then return null; end if;
  while i <= length(encoded) loop
    if substr(encoded,i,1) = '%' then
      if substr(encoded,i+1,2) !~ '^[0-9A-Fa-f]{2}$' then return null; end if;
      bytes := bytes || decode(substr(encoded,i+1,2),'hex'); i := i + 3;
    else bytes := bytes || convert_to(substr(encoded,i,1),'UTF8'); i := i + 1; end if;
  end loop;
  result := convert_from(bytes,'UTF8');
  if result ~ '(^|/)(\.|\.\.|)(/|$)' or position(chr(92) in result) > 0 then return null; end if;
  return result;
exception when others then return null;
end;
$$;

create or replace function public.internal_attachment_inventory(project_origin text)
returns table(bucket text, source_table text, record_id text, reference_hash text, problem text)
language sql stable security definer set search_path = public as $$
  with refs as (
    select 'resident-endorsement-files'::text bucket, 'resident_endorsements'::text source_table,
      p.id::text record_id, a.value->>'url' reference
    from public.resident_endorsements p
    cross join lateral jsonb_array_elements(case when jsonb_typeof(p.attachments)='array' then p.attachments else '[]'::jsonb end) a
    union all
    select 'resident-census-evidence', 'resident_monthly_census', c.id::text, v.reference
    from public.resident_monthly_census c cross join lateral (values
      (c.fuente_ct_evidence_url),(c.fuente_mri_evidence_url),(c.fuente_xray_evidence_url),
      (c.mandaue_ct_evidence_url),(c.mandaue_mri_evidence_url),(c.attendance_evidence_url)) v(reference)
    where v.reference is not null and v.reference <> ''
  )
  select r.bucket,r.source_table,r.record_id,md5(coalesce(r.reference,'')),
    case when public.internal_attachment_path(r.reference,r.bucket,project_origin) is null then 'unrecognized_reference'
    when not exists(select 1 from storage.objects o where o.bucket_id=r.bucket
      and o.name=public.internal_attachment_path(r.reference,r.bucket,project_origin)) then 'missing_object'
    else null end
  from refs r;
$$;

create or replace function public.activate_internal_attachment_privacy(p_bucket text, p_project_origin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_bucket is null or p_bucket not in ('resident-endorsement-files','resident-census-evidence')
    or p_project_origin is null or p_project_origin !~ '^https://[a-z0-9-]+\.supabase\.co$' then
    raise exception 'Invalid cutover configuration.';
  end if;
  -- Freeze reference writes during validation and switch; objects remain in place.
  lock table public.resident_endorsements, public.resident_monthly_census in share mode;
  lock table storage.objects in share mode;
  if exists(select 1 from public.internal_attachment_inventory(p_project_origin) i where i.bucket=p_bucket and i.problem is not null) then
    raise exception 'Attachment inventory has unresolved references. Bucket remains unchanged.';
  end if;
  update storage.buckets set public=false where id=p_bucket;
  if not found then raise exception 'Attachment bucket does not exist.'; end if;
end;
$$;
revoke all on function public.internal_attachment_path(text,text,text) from public,anon,authenticated;
revoke all on function public.internal_attachment_inventory(text) from public,anon,authenticated;
revoke all on function public.activate_internal_attachment_privacy(text,text) from public,anon,authenticated;
commit;
