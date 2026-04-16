create table if not exists public.case_shares (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  public_token uuid not null default gen_random_uuid() unique,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz
);

create unique index if not exists idx_case_shares_case_id on public.case_shares(case_id);
create unique index if not exists idx_case_shares_public_token on public.case_shares(public_token);
create index if not exists idx_case_shares_active_token on public.case_shares(public_token) where is_active = true;

alter table public.case_shares enable row level security;

drop policy if exists "case_shares_no_direct_select" on public.case_shares;
create policy "case_shares_no_direct_select"
on public.case_shares
for select
using (false);

drop policy if exists "case_shares_no_direct_insert" on public.case_shares;
create policy "case_shares_no_direct_insert"
on public.case_shares
for insert
with check (false);

drop policy if exists "case_shares_no_direct_update" on public.case_shares;
create policy "case_shares_no_direct_update"
on public.case_shares
for update
using (false)
with check (false);

drop policy if exists "case_shares_no_direct_delete" on public.case_shares;
create policy "case_shares_no_direct_delete"
on public.case_shares
for delete
using (false);

create or replace function public.is_case_share_manager(p_case_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  case_owner uuid;
  legacy_role text;
begin
  if current_user_id is null then
    return false;
  end if;

  select created_by into case_owner
  from public.cases
  where id = p_case_id;

  if case_owner is null then
    return false;
  end if;

  if case_owner = current_user_id then
    return true;
  end if;

  select role into legacy_role
  from public.profiles
  where id = current_user_id;

  if legacy_role in ('admin', 'moderator', 'training_officer') then
    return true;
  end if;

  return exists (
    select 1
    from public.user_roles
    where user_id = current_user_id
      and role in ('admin', 'moderator', 'training_officer')
  );
end;
$$;

create or replace function public.create_or_get_case_share(p_case_id uuid)
returns table (
  share_case_id uuid,
  public_token uuid,
  is_active boolean,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  published_case_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select c.id into published_case_id
  from public.cases c
  where c.id = p_case_id
    and c.status = 'published';

  if published_case_id is null then
    raise exception 'Published case not found.';
  end if;

  return query
  insert into public.case_shares as shares (
    case_id,
    public_token,
    is_active,
    created_by,
    revoked_at
  )
  values (
    p_case_id,
    gen_random_uuid(),
    true,
    current_user_id,
    null
  )
  on conflict (case_id) do update
  set
    public_token = case
      when shares.is_active then shares.public_token
      else gen_random_uuid()
    end,
    is_active = true,
    revoked_at = null,
    updated_at = timezone('utc', now()),
    created_by = coalesce(shares.created_by, current_user_id)
  returning
    shares.case_id as share_case_id,
    shares.public_token,
    shares.is_active,
    shares.created_by,
    shares.created_at,
    shares.updated_at,
    shares.revoked_at;
end;
$$;

create or replace function public.regenerate_case_share(p_case_id uuid)
returns table (
  share_case_id uuid,
  public_token uuid,
  is_active boolean,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not public.is_case_share_manager(p_case_id) then
    raise exception 'You do not have permission to manage this share link.';
  end if;

  if not exists (
    select 1
    from public.case_shares shares
    where shares.case_id = p_case_id
  ) then
    return query
    select *
    from public.create_or_get_case_share(p_case_id);
    return;
  end if;

  return query
  update public.case_shares as shares
  set
    public_token = gen_random_uuid(),
    is_active = true,
    revoked_at = null,
    updated_at = timezone('utc', now())
  where shares.case_id = p_case_id
  returning
    shares.case_id as share_case_id,
    shares.public_token,
    shares.is_active,
    shares.created_by,
    shares.created_at,
    shares.updated_at,
    shares.revoked_at;
end;
$$;

create or replace function public.revoke_case_share(p_case_id uuid)
returns table (
  share_case_id uuid,
  public_token uuid,
  is_active boolean,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not public.is_case_share_manager(p_case_id) then
    raise exception 'You do not have permission to manage this share link.';
  end if;

  return query
  update public.case_shares as shares
  set
    is_active = false,
    revoked_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where shares.case_id = p_case_id
  returning
    shares.case_id as share_case_id,
    shares.public_token,
    shares.is_active,
    shares.created_by,
    shares.created_at,
    shares.updated_at,
    shares.revoked_at;

  if not found then
    raise exception 'Share link not found.';
  end if;
end;
$$;

create or replace function public.resolve_public_case_by_token(p_public_token uuid)
returns setof public.cases
language sql
security definer
set search_path = public
stable
as $$
  select c.*
  from public.case_shares shares
  join public.cases c on c.id = shares.case_id
  where shares.public_token = p_public_token
    and shares.is_active = true
    and shares.revoked_at is null
    and c.status = 'published'
  limit 1;
$$;

grant execute on function public.create_or_get_case_share(uuid) to authenticated;
grant execute on function public.regenerate_case_share(uuid) to authenticated;
grant execute on function public.revoke_case_share(uuid) to authenticated;
grant execute on function public.resolve_public_case_by_token(uuid) to anon, authenticated;
