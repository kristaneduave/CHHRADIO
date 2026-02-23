-- Roles & permissions refactor:
-- - faculty -> moderator
-- - moderator role support
-- - announcements manage-any for admin/training_officer/moderator
-- - consultants keep own announcement management
-- - global quiz attempt analytics for admin/training_officer/moderator

-- 1) Data migration: faculty -> moderator
update public.profiles
set role = 'moderator'
where role = 'faculty';

-- 2) Ensure profiles.role supports moderator and removes faculty
do $$
declare
  role_udt text;
  role_typname text;
begin
  select c.udt_name, t.typname
  into role_udt, role_typname
  from information_schema.columns c
  join pg_type t on t.typname = c.udt_name
  where c.table_schema = 'public'
    and c.table_name = 'profiles'
    and c.column_name = 'role'
  limit 1;

  -- Enum-backed role column
  if role_typname is not null and exists (select 1 from pg_type where typname = role_typname and typtype = 'e') then
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = role_typname
        and e.enumlabel = 'moderator'
    ) then
      execute format('alter type %I add value ''moderator''', role_typname);
    end if;
  else
    -- text/check-backed role column
    alter table public.profiles drop constraint if exists profiles_role_check;
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('admin', 'moderator', 'training_officer', 'consultant', 'resident', 'fellow'));
  end if;
end $$;

-- 3) Announcements policies
drop policy if exists "Privileged users can insert announcements" on public.announcements;
drop policy if exists "Privileged users can update announcements" on public.announcements;
drop policy if exists "Privileged users can delete announcements" on public.announcements;
drop policy if exists "Faculty and Consultants can insert announcements" on public.announcements;
drop policy if exists "Admins can do everything on announcements" on public.announcements;
drop policy if exists "Authenticated users can insert announcements" on public.announcements;
drop policy if exists "Users can update their own announcements" on public.announcements;
drop policy if exists "Users can delete their own announcements" on public.announcements;

create policy "announcements_insert_privileged_publishers"
on public.announcements
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'training_officer', 'moderator', 'consultant')
  )
);

create policy "announcements_update_by_admin_to_or_moderator_any_or_consultant_own"
on public.announcements
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role in ('admin', 'training_officer', 'moderator')
        or (p.role = 'consultant' and announcements.author_id = auth.uid())
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role in ('admin', 'training_officer', 'moderator')
        or (p.role = 'consultant' and announcements.author_id = auth.uid())
      )
  )
);

create policy "announcements_delete_by_admin_to_or_moderator_any_or_consultant_own"
on public.announcements
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role in ('admin', 'training_officer', 'moderator')
        or (p.role = 'consultant' and announcements.author_id = auth.uid())
      )
  )
);

-- 4) Notification insert policies
drop policy if exists "notifications_insert_by_admin_or_training_officer" on public.notifications;
drop policy if exists "notifications_insert_by_privileged_publishers" on public.notifications;

create policy "notifications_insert_by_privileged_publishers_v2"
on public.notifications
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'training_officer', 'moderator', 'consultant')
  )
);

drop policy if exists "notification_recipients_insert_by_admin_or_training_officer" on public.notification_recipients;
drop policy if exists "notification_recipients_insert_by_privileged_publishers" on public.notification_recipients;

create policy "notification_recipients_insert_by_privileged_publishers_v2"
on public.notification_recipients
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'training_officer', 'moderator', 'consultant')
  )
);

-- 5) Quiz attempts analytics policy
drop policy if exists "quiz_attempts_select_exam_owner" on public.quiz_attempts;
drop policy if exists "quiz_attempts_select_own" on public.quiz_attempts;
drop policy if exists "quiz_attempts_select_own_or_exam_owner_or_privileged" on public.quiz_attempts;

create policy "quiz_attempts_select_own_or_exam_owner_or_privileged"
on public.quiz_attempts
for select
to authenticated
using (
  -- attempt owner
  user_id = auth.uid()
  -- exam owner
  or exists (
    select 1
    from public.quiz_exams e
    where e.id = quiz_attempts.exam_id
      and e.created_by = auth.uid()
  )
  -- global privileged roles
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'training_officer', 'moderator')
  )
);

