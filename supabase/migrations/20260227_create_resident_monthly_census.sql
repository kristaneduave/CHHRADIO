create table if not exists public.resident_monthly_census (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.profiles(id) on delete cascade,
  report_month date not null,
  interesting_cases_submitted integer not null default 0 check (interesting_cases_submitted >= 0),
  notes_count integer not null default 0 check (notes_count >= 0),
  fuente_ct_census integer not null default 0 check (fuente_ct_census >= 0),
  fuente_mri_census integer not null default 0 check (fuente_mri_census >= 0),
  fuente_xray_census integer not null default 0 check (fuente_xray_census >= 0),
  plates_count integer not null default 0 check (plates_count >= 0),
  has_absence boolean not null default false,
  absence_days integer not null default 0 check (absence_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resident_id, report_month)
);

create index if not exists idx_resident_monthly_census_resident_id on public.resident_monthly_census (resident_id);
create index if not exists idx_resident_monthly_census_report_month on public.resident_monthly_census (report_month);

create or replace function public.set_resident_monthly_census_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_resident_monthly_census_updated_at on public.resident_monthly_census;
create trigger trg_set_resident_monthly_census_updated_at
before update on public.resident_monthly_census
for each row execute function public.set_resident_monthly_census_updated_at();

alter table public.resident_monthly_census enable row level security;

drop policy if exists "resident_monthly_census_select_own_or_admin" on public.resident_monthly_census;
create policy "resident_monthly_census_select_own_or_admin"
on public.resident_monthly_census
for select
to authenticated
using (
  resident_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
);

drop policy if exists "resident_monthly_census_insert_own" on public.resident_monthly_census;
create policy "resident_monthly_census_insert_own"
on public.resident_monthly_census
for insert
to authenticated
with check (resident_id = auth.uid());

drop policy if exists "resident_monthly_census_update_own_or_admin" on public.resident_monthly_census;
create policy "resident_monthly_census_update_own_or_admin"
on public.resident_monthly_census
for update
to authenticated
using (
  resident_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
)
with check (
  resident_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
);
