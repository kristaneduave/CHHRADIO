create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null,
  message text not null,
  link_screen text,
  link_entity_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique(notification_id, user_id)
);

create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
create index if not exists idx_notifications_severity on public.notifications(severity);
create index if not exists idx_notification_recipients_user_read_created
  on public.notification_recipients(user_id, read_at, created_at desc);

alter table public.notifications enable row level security;
alter table public.notification_recipients enable row level security;

create policy "notifications_select_for_recipient"
on public.notifications
for select
to authenticated
using (
  exists (
    select 1 from public.notification_recipients nr
    where nr.notification_id = notifications.id
      and nr.user_id = auth.uid()
      and nr.archived_at is null
  )
);

create policy "notifications_insert_by_admin_or_training_officer"
on public.notifications
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'training_officer')
  )
);

create policy "notification_recipients_select_own"
on public.notification_recipients
for select
to authenticated
using (user_id = auth.uid());

create policy "notification_recipients_update_own"
on public.notification_recipients
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "notification_recipients_insert_by_admin_or_training_officer"
on public.notification_recipients
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'training_officer')
  )
);
