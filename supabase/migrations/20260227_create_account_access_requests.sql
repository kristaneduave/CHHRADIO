create table if not exists public.account_access_requests (
  id uuid primary key default gen_random_uuid(),
  public_token uuid not null default gen_random_uuid() unique,
  full_name text not null check (char_length(trim(full_name)) >= 2),
  email text not null,
  requested_role text not null check (requested_role in ('resident', 'consultant', 'fellow')),
  year_level text null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text null,
  reviewed_by uuid null references public.profiles(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_account_access_requests_status_created_at
  on public.account_access_requests (status, created_at desc);

create index if not exists idx_account_access_requests_email_lower
  on public.account_access_requests (lower(email));

create unique index if not exists idx_account_access_requests_pending_email
  on public.account_access_requests (lower(email))
  where status = 'pending';

create or replace function public.set_account_access_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_account_access_requests_updated_at on public.account_access_requests;
create trigger trg_set_account_access_requests_updated_at
before update on public.account_access_requests
for each row execute function public.set_account_access_requests_updated_at();

alter table public.account_access_requests enable row level security;

drop policy if exists "account_access_requests_insert_public" on public.account_access_requests;
create policy "account_access_requests_insert_public"
on public.account_access_requests
for insert
to anon, authenticated
with check (true);

drop policy if exists "account_access_requests_select_by_public_token" on public.account_access_requests;
create policy "account_access_requests_admin_select"
on public.account_access_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
);

drop policy if exists "account_access_requests_admin_update" on public.account_access_requests;
create policy "account_access_requests_admin_update"
on public.account_access_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
);

create or replace function public.get_account_access_request_status(p_public_token uuid)
returns table (
  public_token uuid,
  email text,
  requested_role text,
  year_level text,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    r.public_token,
    r.email,
    r.requested_role,
    r.year_level,
    r.status,
    r.created_at,
    r.reviewed_at
  from public.account_access_requests r
  where r.public_token = p_public_token
  limit 1;
$$;

revoke all on function public.get_account_access_request_status(uuid) from public;
grant execute on function public.get_account_access_request_status(uuid) to anon, authenticated;
