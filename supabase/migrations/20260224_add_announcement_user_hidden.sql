-- Per-user hidden announcements (non-destructive visibility control)
create table if not exists public.announcement_user_hidden (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

create index if not exists idx_announcement_user_hidden_user_hidden_at
  on public.announcement_user_hidden(user_id, hidden_at desc);

alter table public.announcement_user_hidden enable row level security;

drop policy if exists "announcement_user_hidden_select_own" on public.announcement_user_hidden;
create policy "announcement_user_hidden_select_own"
on public.announcement_user_hidden
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "announcement_user_hidden_insert_own" on public.announcement_user_hidden;
create policy "announcement_user_hidden_insert_own"
on public.announcement_user_hidden
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "announcement_user_hidden_delete_own" on public.announcement_user_hidden;
create policy "announcement_user_hidden_delete_own"
on public.announcement_user_hidden
for delete
to authenticated
using (auth.uid() = user_id);
