create table if not exists public.profile_private_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_profile_private_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_profile_private_notes_updated_at on public.profile_private_notes;
create trigger trg_set_profile_private_notes_updated_at
before update on public.profile_private_notes
for each row execute function public.set_profile_private_notes_updated_at();

alter table public.profile_private_notes enable row level security;

drop policy if exists "profile_private_notes_select_own" on public.profile_private_notes;
create policy "profile_private_notes_select_own"
on public.profile_private_notes
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "profile_private_notes_insert_own" on public.profile_private_notes;
create policy "profile_private_notes_insert_own"
on public.profile_private_notes
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "profile_private_notes_update_own" on public.profile_private_notes;
create policy "profile_private_notes_update_own"
on public.profile_private_notes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "profile_private_notes_delete_own" on public.profile_private_notes;
create policy "profile_private_notes_delete_own"
on public.profile_private_notes
for delete
to authenticated
using (auth.uid() = user_id);
