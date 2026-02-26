-- Workstation viewer v3: assigned occupancy + richer current status view

alter table public.occupancy_sessions
  add column if not exists occupancy_mode text not null default 'self',
  add column if not exists assigned_by_user_id uuid null references public.profiles(id) on delete set null,
  add column if not exists occupant_user_id uuid null references public.profiles(id) on delete set null,
  add column if not exists occupant_display_name text null,
  add column if not exists expires_at timestamptz null,
  add column if not exists status_message text null;

alter table public.occupancy_sessions
  drop constraint if exists occupancy_sessions_occupancy_mode_check;

alter table public.occupancy_sessions
  add constraint occupancy_sessions_occupancy_mode_check
  check (occupancy_mode in ('self', 'assigned_user', 'assigned_external'));

create index if not exists idx_occupancy_sessions_active_expires
  on public.occupancy_sessions (workstation_id, ended_at, expires_at);

create index if not exists idx_occupancy_sessions_occupant_user
  on public.occupancy_sessions (occupant_user_id);

drop policy if exists "Enable insert for authenticated users on their own sessions" on public.occupancy_sessions;
drop policy if exists "Enable update for users on their own active sessions" on public.occupancy_sessions;
drop policy if exists "occupancy_sessions_insert_authenticated" on public.occupancy_sessions;
drop policy if exists "occupancy_sessions_update_authenticated_active" on public.occupancy_sessions;

create policy "occupancy_sessions_insert_authenticated"
on public.occupancy_sessions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    occupancy_mode = 'self'
    or (occupancy_mode = 'assigned_user' and occupant_user_id is not null)
    or (occupancy_mode = 'assigned_external' and occupant_display_name is not null and btrim(occupant_display_name) <> '')
  )
);

create policy "occupancy_sessions_update_authenticated_active"
on public.occupancy_sessions
for update
to authenticated
using (
  ended_at is null
  and (expires_at is null or expires_at > now())
)
with check (true);

drop view if exists public.current_workstation_status;

create view public.current_workstation_status as
select
  w.id,
  w.label,
  w.x,
  w.y,
  w.floor_id,
  w.section,
  coalesce(
    w.status_override,
    case
      when s.id is not null then 'IN_USE'
      else 'AVAILABLE'
    end
  ) as status,
  coalesce(
    nullif(s.occupant_display_name, ''),
    p.nickname,
    p.full_name,
    s.display_name_snapshot,
    'Staff'
  ) as occupant_name,
  coalesce(s.occupant_user_id, s.user_id) as occupant_id,
  s.started_at,
  s.last_seen_at,
  s.status_message,
  s.occupancy_mode,
  s.assigned_by_user_id,
  s.expires_at
from public.workstations w
left join lateral (
  select *
  from public.occupancy_sessions
  where workstation_id = w.id
    and ended_at is null
    and (expires_at is null or expires_at > now())
  order by started_at desc
  limit 1
) s on true
left join public.profiles p
  on p.id = coalesce(s.occupant_user_id, s.user_id);
