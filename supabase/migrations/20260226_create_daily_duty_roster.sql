create table if not exists public.daily_duty_roster (
  id uuid primary key default gen_random_uuid(),
  duty_date date not null,
  user_id uuid null references public.profiles(id) on delete set null,
  display_name text not null check (char_length(trim(display_name)) > 0),
  role text null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (duty_date, display_name)
);

create index if not exists idx_daily_duty_roster_date on public.daily_duty_roster (duty_date);
create index if not exists idx_daily_duty_roster_user on public.daily_duty_roster (user_id);

create or replace function public.set_daily_duty_roster_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_daily_duty_roster_updated_at on public.daily_duty_roster;
create trigger trg_set_daily_duty_roster_updated_at
before update on public.daily_duty_roster
for each row execute function public.set_daily_duty_roster_updated_at();

alter table public.daily_duty_roster enable row level security;

drop policy if exists "daily_duty_roster_select_authenticated" on public.daily_duty_roster;
create policy "daily_duty_roster_select_authenticated"
on public.daily_duty_roster
for select
to authenticated
using (true);

drop policy if exists "daily_duty_roster_insert_admin_or_moderator" on public.daily_duty_roster;
create policy "daily_duty_roster_insert_admin_or_moderator"
on public.daily_duty_roster
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator')
  )
);

drop policy if exists "daily_duty_roster_update_admin_or_moderator" on public.daily_duty_roster;
create policy "daily_duty_roster_update_admin_or_moderator"
on public.daily_duty_roster
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator')
  )
);

drop policy if exists "daily_duty_roster_delete_admin_or_moderator" on public.daily_duty_roster;
create policy "daily_duty_roster_delete_admin_or_moderator"
on public.daily_duty_roster
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator')
  )
);
