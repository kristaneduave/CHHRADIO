begin;
create or replace function public.can_access_internal_attachment(bucket text, object_name text, operation text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_user_is_staff() and case
    when bucket = 'resident-endorsement-files' then
      public.current_user_has_any_role(array['resident','admin','moderator'])
      and (operation = 'read' or split_part(object_name,'/',1) = auth.uid()::text
        or (operation <> 'insert' and public.current_user_has_any_role(array['admin','moderator'])))
    when bucket = 'resident-census-evidence' then
      split_part(object_name,'/',1) = auth.uid()::text
      or (operation <> 'insert' and public.current_user_has_any_role(array['admin','moderator','training_officer']))
    else false end;
$$;
revoke all on function public.can_access_internal_attachment(text,text,text) from public;
grant execute on function public.can_access_internal_attachment(text,text,text) to anon, authenticated;

-- A restrictive fence prevents other permissive storage policies bypassing these rules.
-- It does not affect unrelated public teaching/image buckets.
create policy internal_attachments_read_fence on storage.objects as restrictive for select to public
using (bucket_id not in ('resident-endorsement-files','resident-census-evidence')
  or public.can_access_internal_attachment(bucket_id,name,'read'));
create policy internal_attachments_insert_fence on storage.objects as restrictive for insert to public
with check (bucket_id not in ('resident-endorsement-files','resident-census-evidence')
  or public.can_access_internal_attachment(bucket_id,name,'insert'));
create policy internal_attachments_update_fence on storage.objects as restrictive for update to public
using (bucket_id not in ('resident-endorsement-files','resident-census-evidence')
  or public.can_access_internal_attachment(bucket_id,name,'write'))
with check (bucket_id not in ('resident-endorsement-files','resident-census-evidence')
  or public.can_access_internal_attachment(bucket_id,name,'write'));
create policy internal_attachments_delete_fence on storage.objects as restrictive for delete to public
using (bucket_id not in ('resident-endorsement-files','resident-census-evidence')
  or public.can_access_internal_attachment(bucket_id,name,'write'));
create policy internal_attachments_read on storage.objects for select to authenticated
using (public.can_access_internal_attachment(bucket_id,name,'read'));
create policy internal_attachments_insert on storage.objects for insert to authenticated
with check (public.can_access_internal_attachment(bucket_id,name,'insert'));
create policy internal_attachments_update on storage.objects for update to authenticated
using (public.can_access_internal_attachment(bucket_id,name,'write'))
with check (public.can_access_internal_attachment(bucket_id,name,'write'));
create policy internal_attachments_delete on storage.objects for delete to authenticated
using (public.can_access_internal_attachment(bucket_id,name,'write'));
-- Bucket privacy is a separately gated cutover after reader deployment and inventory validation.
commit;
