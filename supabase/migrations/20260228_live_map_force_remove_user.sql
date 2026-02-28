create table if not exists public.live_map_kick_audit (
  id uuid primary key default gen_random_uuid(),
  kicked_by uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text null,
  cleared_presence_count integer not null default 0,
  released_workstation_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_live_map_kick_audit_target_created
  on public.live_map_kick_audit(target_user_id, created_at desc);

create index if not exists idx_live_map_kick_audit_actor_created
  on public.live_map_kick_audit(kicked_by, created_at desc);

alter table public.live_map_kick_audit enable row level security;

drop policy if exists "live_map_kick_audit_select_authenticated" on public.live_map_kick_audit;
create policy "live_map_kick_audit_select_authenticated"
on public.live_map_kick_audit
for select
to authenticated
using (true);

create or replace function public.force_remove_user_from_live_map(
  p_target_user_id uuid,
  p_reason text default null
)
returns table (
  target_user_id uuid,
  cleared_presence_count integer,
  released_workstation_count integer,
  kicked_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
  v_cleared integer := 0;
  v_released integer := 0;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if p_target_user_id is null then
    raise exception 'Target user is required';
  end if;

  if v_actor = p_target_user_id then
    raise exception 'You cannot remove yourself from live map using kick action';
  end if;

  update public.workspace_area_presence
  set
    is_present = false,
    cleared_at = v_now,
    updated_at = v_now
  where user_id = p_target_user_id
    and is_present = true
    and cleared_at is null;
  get diagnostics v_cleared = row_count;

  update public.occupancy_sessions
  set
    ended_at = v_now
  where ended_at is null
    and (expires_at is null or expires_at > v_now)
    and (
      occupant_user_id = p_target_user_id
      or user_id = p_target_user_id
    );
  get diagnostics v_released = row_count;

  insert into public.live_map_kick_audit (
    kicked_by,
    target_user_id,
    reason,
    cleared_presence_count,
    released_workstation_count,
    created_at
  )
  values (
    v_actor,
    p_target_user_id,
    nullif(btrim(coalesce(p_reason, '')), ''),
    v_cleared,
    v_released,
    v_now
  );

  return query
  select
    p_target_user_id,
    v_cleared,
    v_released,
    v_actor,
    v_now;
end;
$$;

revoke all on function public.force_remove_user_from_live_map(uuid, text) from public;
grant execute on function public.force_remove_user_from_live_map(uuid, text) to authenticated;
