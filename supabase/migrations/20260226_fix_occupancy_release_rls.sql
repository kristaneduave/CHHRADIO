-- Fix occupancy session release under RLS:
-- allow users to update their own active row to ended_at != null.

drop policy if exists "Enable update for users on their own active sessions" on public.occupancy_sessions;
drop policy if exists "occupancy_sessions_update_authenticated_active" on public.occupancy_sessions;

create policy "occupancy_sessions_update_authenticated_active"
on public.occupancy_sessions
for update
to authenticated
using (
  auth.uid() = user_id
  and ended_at is null
)
with check (
  auth.uid() = user_id
);
