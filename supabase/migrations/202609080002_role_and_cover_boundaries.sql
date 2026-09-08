begin;

-- SECURITY INVOKER deliberately distinguishes direct API writes from the trusted
-- SECURITY DEFINER role RPC. Never use a caller-settable session flag as a bypass.
create or replace function public.guard_direct_role_write()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user in ('anon','authenticated') then
    if tg_table_name = 'user_roles' then
      raise exception 'Use administrator role assignment.' using errcode = '42501';
    elsif new.role is distinct from old.role then
      raise exception 'Use administrator role assignment.' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists trg_prevent_unapproved_profile_role_change on public.profiles;
create trigger trg_prevent_unapproved_profile_role_change before update of role on public.profiles
  for each row execute function public.guard_direct_role_write();
create trigger trg_guard_direct_user_roles before insert or update or delete on public.user_roles
  for each row execute function public.guard_direct_role_write();
revoke insert, update, delete on public.user_roles from anon, authenticated;
revoke delete on public.profiles from anon, authenticated;
-- A restrictive insert policy also fences any surviving legacy permissive policy.
create policy profiles_approved_insert_fence on public.profiles as restrictive for insert to authenticated
with check (id = auth.uid() and role in ('resident','consultant','fellow') and exists (
  select 1 from public.account_access_requests r
  where lower(r.email) = lower(trim(coalesce(auth.jwt()->>'email','')))
  and r.status = 'approved' and r.requested_role = profiles.role
  and (r.claimed_by is null or r.claimed_by = auth.uid())
));
-- Role policy alone cannot narrow a table-level grant. The invoker trigger guards profiles.role.
revoke all on function public.guard_direct_role_write() from public, anon, authenticated;

create or replace function public.current_user_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p where p.id = auth.uid()
    and p.role in ('admin','faculty','moderator','consultant','resident','fellow','training_officer')
  );
$$;
revoke all on function public.current_user_is_staff() from public;
grant execute on function public.current_user_is_staff() to anon, authenticated;

-- Replace all cover policies, since permissive policies combine using OR.
do $$ declare policy_name text; begin
  for policy_name in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'consultant_covers'
  loop execute format('drop policy %I on public.consultant_covers',policy_name); end loop;
end $$;
alter table public.consultant_covers enable row level security;
revoke all on public.consultant_covers from anon;
grant select, insert, update, delete on public.consultant_covers to authenticated;
create policy consultant_covers_staff on public.consultant_covers for all to authenticated
  using (public.current_user_is_staff()) with check (public.current_user_is_staff());
commit;
