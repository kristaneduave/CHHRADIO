drop policy if exists "Admins can update any profile" on public.profiles;

create policy "Admins can update any profile"
on public.profiles
for update
to authenticated
using (public.current_user_has_role('admin'))
with check (public.current_user_has_role('admin'));
