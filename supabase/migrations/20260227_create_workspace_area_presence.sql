create table if not exists public.workspace_area_presence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  floor_id uuid not null references public.floors(id) on delete cascade,
  x double precision not null,
  y double precision not null,
  status_message text null,
  is_present boolean not null default true,
  last_seen_at timestamptz not null default now(),
  cleared_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_workspace_area_presence_user_active
  on public.workspace_area_presence(user_id)
  where cleared_at is null;

create index if not exists idx_workspace_area_presence_floor_active
  on public.workspace_area_presence(floor_id)
  where cleared_at is null;

create or replace function public.set_workspace_area_presence_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_workspace_area_presence_updated_at on public.workspace_area_presence;
create trigger trg_set_workspace_area_presence_updated_at
before update on public.workspace_area_presence
for each row execute function public.set_workspace_area_presence_updated_at();

alter table public.workspace_area_presence enable row level security;

drop policy if exists "workspace_area_presence_select_authenticated" on public.workspace_area_presence;
create policy "workspace_area_presence_select_authenticated"
on public.workspace_area_presence
for select
to authenticated
using (true);

drop policy if exists "workspace_area_presence_insert_owner" on public.workspace_area_presence;
create policy "workspace_area_presence_insert_owner"
on public.workspace_area_presence
for insert
to authenticated
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
);

drop policy if exists "workspace_area_presence_update_owner_or_admin" on public.workspace_area_presence;
create policy "workspace_area_presence_update_owner_or_admin"
on public.workspace_area_presence
for update
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
);
