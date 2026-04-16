drop policy if exists "Admins can view all profiles" on public.profiles;

create policy "Admins can view all profiles"
on public.profiles
for select
to authenticated
using (public.current_user_has_role('admin'));
