begin;

create or replace function public.set_user_roles(p_user_id uuid, p_primary_role text, p_roles text[])
returns void language plpgsql security definer set search_path = public as $$
declare
  allowed_roles constant text[] := array['admin','faculty','moderator','consultant','resident','fellow','training_officer'];
  selected_roles text[];
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Role assignment requires a fresh read-committed transaction.' using errcode = '40001';
  end if;
  -- Serialize all role replacements, including requests demoting different admins.
  lock table public.profiles in share row exclusive mode;
  lock table public.user_roles in share row exclusive mode;
  if auth.uid() is null or not public.current_user_has_role('admin') then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  if p_primary_role is null or p_roles is null or cardinality(p_roles) = 0
    or array_position(p_roles, null) is not null or not (p_roles <@ allowed_roles)
    or not (p_primary_role = any(p_roles)) then
    raise exception 'Invalid role selection.' using errcode = '22023';
  end if;
  select array_agg(distinct r) into selected_roles from unnest(p_roles) r;
  if 'training_officer' = any(selected_roles) and cardinality(selected_roles) <> 1 then
    raise exception 'Training officer must be the only role.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Staff profile not found.' using errcode = '22023';
  end if;
  update public.profiles set role = p_primary_role where id = p_user_id;
  delete from public.user_roles where user_id = p_user_id;
  insert into public.user_roles(user_id, role, created_by)
    select p_user_id, r, auth.uid() from unnest(selected_roles) r;
  if not exists (
    select 1 from public.profiles p where p.role = 'admin'
    or exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'admin')
  ) then
    raise exception 'The final administrator cannot be removed.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.set_user_roles(uuid,text,text[]) from public, anon;
grant execute on function public.set_user_roles(uuid,text,text[]) to authenticated;

-- Existing profiles cannot replay historical approvals to replace their roles.
create or replace function public.complete_approved_profile(p_full_name text, p_display_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  caller_id uuid := auth.uid();
  caller_email text := lower(trim(coalesce(auth.jwt()->>'email','')));
  approved_request public.account_access_requests;
  result_profile public.profiles;
begin
  if caller_id is null or caller_email = '' then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if nullif(trim(p_full_name),'') is null or nullif(trim(p_display_name),'') is null then
    raise exception 'Name and display name are required.' using errcode = '22023';
  end if;
  -- Same lock order as role administration; makes activation idempotent under concurrency.
  lock table public.profiles in share row exclusive mode;
  select * into result_profile from public.profiles where id = caller_id;
  if not found then
    select * into approved_request from public.account_access_requests r
      where lower(r.email) = caller_email and r.status = 'approved'
      and r.requested_role in ('resident','consultant','fellow')
      and (r.claimed_by is null or r.claimed_by = caller_id)
      order by r.reviewed_at desc nulls last, r.created_at desc limit 1 for update;
    if not found then raise exception 'Staff approval required.' using errcode = '42501'; end if;
    insert into public.profiles(id,full_name,nickname,username,role,year_level,updated_at)
      values (caller_id,trim(p_full_name),trim(p_display_name),
        lower(regexp_replace(split_part(caller_email,'@',1),'[^a-zA-Z0-9_]+','','g')) || '_' || substr(caller_id::text,1,8),
        approved_request.requested_role,approved_request.year_level,now()) returning * into result_profile;
    update public.account_access_requests set claimed_by = caller_id, claimed_at = coalesce(claimed_at,now())
      where id = approved_request.id;
  else
    -- Complete missing display fields on a legacy profile without changing its privileges.
    update public.profiles set full_name=trim(p_full_name), nickname=trim(p_display_name), updated_at=now()
      where id=caller_id returning * into result_profile;
  end if;
  return jsonb_build_object('id',result_profile.id,'full_name',result_profile.full_name,
    'nickname',result_profile.nickname,'role',result_profile.role,'year_level',result_profile.year_level);
end;
$$;
revoke all on function public.complete_approved_profile(text,text) from public, anon;
grant execute on function public.complete_approved_profile(text,text) to authenticated;
commit;
