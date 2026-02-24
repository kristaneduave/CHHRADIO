-- Per-user saved announcements for editorial news feed.
create table if not exists public.announcement_user_saved (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

create index if not exists idx_announcement_user_saved_user_saved_at
  on public.announcement_user_saved(user_id, saved_at desc);

alter table public.announcement_user_saved enable row level security;

drop policy if exists "announcement_user_saved_select_own" on public.announcement_user_saved;
create policy "announcement_user_saved_select_own"
on public.announcement_user_saved
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "announcement_user_saved_insert_own" on public.announcement_user_saved;
create policy "announcement_user_saved_insert_own"
on public.announcement_user_saved
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "announcement_user_saved_delete_own" on public.announcement_user_saved;
create policy "announcement_user_saved_delete_own"
on public.announcement_user_saved
for delete
to authenticated
using (auth.uid() = user_id);
