create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'faculty', 'moderator', 'consultant', 'resident', 'fellow', 'training_officer')),
  created_at timestamptz not null default now(),
  created_by uuid null references public.profiles(id) on delete set null,
  primary key (user_id, role)
);

create index if not exists idx_user_roles_role on public.user_roles(role);

alter table public.user_roles enable row level security;

drop policy if exists "user_roles_select_authenticated" on public.user_roles;
create policy "user_roles_select_authenticated"
on public.user_roles
for select
to authenticated
using (true);

drop policy if exists "user_roles_manage_admin" on public.user_roles;
create policy "user_roles_manage_admin"
on public.user_roles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.user_roles (user_id, role)
select p.id, p.role
from public.profiles p
where p.role is not null
on conflict (user_id, role) do nothing;

create or replace function public.sync_primary_profile_role_to_user_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is not null then
    insert into public.user_roles (user_id, role, created_by)
    values (new.id, new.role, auth.uid())
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_primary_profile_role_to_user_roles on public.profiles;
create trigger trg_sync_primary_profile_role_to_user_roles
after insert or update of role on public.profiles
for each row
execute function public.sync_primary_profile_role_to_user_roles();

create or replace function public.current_user_has_role(target_role text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = target_role
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = target_role
  );
$$;

create or replace function public.current_user_has_any_role(target_roles text[])
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = any(target_roles)
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = any(target_roles)
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_user_has_role('admin');
$$;

create or replace function public.is_quiz_author()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_user_has_any_role(array['admin', 'faculty']);
$$;

create or replace function public.current_user_is_pathology_guideline_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_user_has_role('admin');
$$;

create or replace function public.current_user_can_edit_pathology_guidelines()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_user_has_any_role(array['admin', 'moderator', 'training_officer']);
$$;

create or replace function public.current_user_is_live_aunt_minnie_manager()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_user_has_any_role(array['admin', 'training_officer']);
$$;
