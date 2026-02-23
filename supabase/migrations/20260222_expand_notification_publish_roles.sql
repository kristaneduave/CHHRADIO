-- Allow the same privileged content publishers to emit notifications.
-- This fixes cases where announcements are created successfully but
-- notification rows fail to insert due to stricter role checks.

drop policy if exists "notifications_insert_by_admin_or_training_officer" on public.notifications;
create policy "notifications_insert_by_privileged_publishers"
on public.notifications
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'training_officer', 'faculty', 'consultant')
  )
);

drop policy if exists "notification_recipients_insert_by_admin_or_training_officer" on public.notification_recipients;
create policy "notification_recipients_insert_by_privileged_publishers"
on public.notification_recipients
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'training_officer', 'faculty', 'consultant')
  )
);
