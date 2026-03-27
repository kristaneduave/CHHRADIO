create table if not exists public.consultant_decking_entries (
  id uuid primary key default gen_random_uuid(),
  patient_name text not null check (length(trim(patient_name)) > 0 and length(trim(patient_name)) <= 200),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  patient_source text not null check (patient_source in ('inpatient', 'er', 'outpatient')),
  column_key text not null check (column_key in ('inbox', 'reynes', 'alvarez', 'co-ng', 'vano-yu')),
  position integer not null default 0 check (position >= 0),
  created_by uuid not null references public.profiles(id) on delete cascade,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_consultant_decking_entries_column_position
  on public.consultant_decking_entries (column_key, position);

create index if not exists idx_consultant_decking_entries_updated_at
  on public.consultant_decking_entries (updated_at desc);

create or replace function public.set_consultant_decking_entries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_consultant_decking_entries_updated_at on public.consultant_decking_entries;
create trigger trg_set_consultant_decking_entries_updated_at
before update on public.consultant_decking_entries
for each row execute function public.set_consultant_decking_entries_updated_at();

alter table public.consultant_decking_entries enable row level security;

drop policy if exists "consultant_decking_entries_select_authenticated" on public.consultant_decking_entries;
create policy "consultant_decking_entries_select_authenticated"
on public.consultant_decking_entries
for select
to authenticated
using (true);

drop policy if exists "consultant_decking_entries_insert_authenticated" on public.consultant_decking_entries;
create policy "consultant_decking_entries_insert_authenticated"
on public.consultant_decking_entries
for insert
to authenticated
with check (
  created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists "consultant_decking_entries_update_authenticated" on public.consultant_decking_entries;
create policy "consultant_decking_entries_update_authenticated"
on public.consultant_decking_entries
for update
to authenticated
using (true)
with check (updated_by = auth.uid());

drop policy if exists "consultant_decking_entries_delete_authenticated" on public.consultant_decking_entries;
create policy "consultant_decking_entries_delete_authenticated"
on public.consultant_decking_entries
for delete
to authenticated
using (true);
