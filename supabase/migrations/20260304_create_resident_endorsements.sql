create table if not exists public.resident_endorsements (
  id uuid primary key default gen_random_uuid(),
  duty_date date not null,
  shift text not null check (shift in ('AM', 'PM', 'NIGHT')),
  message text not null check (length(trim(message)) > 0 and length(message) <= 4000),
  tags text[] not null default '{}',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resident_endorsement_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.resident_endorsements(id) on delete cascade,
  message text not null check (length(trim(message)) > 0 and length(message) <= 2000),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_resident_endorsements_duty_date_created
  on public.resident_endorsements (duty_date desc, created_at desc);

create index if not exists idx_resident_endorsements_created_by
  on public.resident_endorsements (created_by);

create index if not exists idx_resident_endorsement_comments_post_created
  on public.resident_endorsement_comments (post_id, created_at asc);

create or replace function public.set_resident_endorsements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_resident_endorsement_comments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_resident_endorsements_updated_at on public.resident_endorsements;
create trigger trg_set_resident_endorsements_updated_at
before update on public.resident_endorsements
for each row execute function public.set_resident_endorsements_updated_at();

drop trigger if exists trg_set_resident_endorsement_comments_updated_at on public.resident_endorsement_comments;
create trigger trg_set_resident_endorsement_comments_updated_at
before update on public.resident_endorsement_comments
for each row execute function public.set_resident_endorsement_comments_updated_at();

alter table public.resident_endorsements enable row level security;
alter table public.resident_endorsement_comments enable row level security;

drop policy if exists "resident_endorsements_select_authenticated" on public.resident_endorsements;
create policy "resident_endorsements_select_authenticated"
on public.resident_endorsements
for select
to authenticated
using (true);

drop policy if exists "resident_endorsements_insert_resident_own" on public.resident_endorsements;
create policy "resident_endorsements_insert_resident_own"
on public.resident_endorsements
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'resident'
  )
);

drop policy if exists "resident_endorsements_update_owner_or_privileged" on public.resident_endorsements;
create policy "resident_endorsements_update_owner_or_privileged"
on public.resident_endorsements
for update
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
);

drop policy if exists "resident_endorsements_delete_owner_or_privileged" on public.resident_endorsements;
create policy "resident_endorsements_delete_owner_or_privileged"
on public.resident_endorsements
for delete
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
);

drop policy if exists "resident_endorsement_comments_select_authenticated" on public.resident_endorsement_comments;
create policy "resident_endorsement_comments_select_authenticated"
on public.resident_endorsement_comments
for select
to authenticated
using (true);

drop policy if exists "resident_endorsement_comments_insert_resident_own" on public.resident_endorsement_comments;
create policy "resident_endorsement_comments_insert_resident_own"
on public.resident_endorsement_comments
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'resident'
  )
);

drop policy if exists "resident_endorsement_comments_update_owner_or_privileged" on public.resident_endorsement_comments;
create policy "resident_endorsement_comments_update_owner_or_privileged"
on public.resident_endorsement_comments
for update
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
);

drop policy if exists "resident_endorsement_comments_delete_owner_or_privileged" on public.resident_endorsement_comments;
create policy "resident_endorsement_comments_delete_owner_or_privileged"
on public.resident_endorsement_comments
for delete
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
);
