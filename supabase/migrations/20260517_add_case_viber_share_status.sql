alter table public.cases
  add column if not exists viber_shared_at timestamptz,
  add column if not exists viber_shared_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_cases_viber_shared_at
  on public.cases (viber_shared_at desc nulls last)
  where status = 'published' and submission_type = 'interesting_case';

create or replace function public.set_case_viber_share_status(
  p_case_id uuid,
  p_shared boolean
)
returns table (
  case_id uuid,
  viber_shared_at timestamptz,
  viber_shared_by uuid,
  viber_shared_by_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.cases c
    where c.id = p_case_id
      and c.status = 'published'
      and c.submission_type = 'interesting_case'
  ) then
    raise exception 'Only published interesting cases can be marked for Viber sharing.';
  end if;

  return query
  update public.cases c
  set
    viber_shared_at = case when p_shared then timezone('utc', now()) else null end,
    viber_shared_by = case when p_shared then current_user_id else null end
  where c.id = p_case_id
  returning
    c.id,
    c.viber_shared_at,
    c.viber_shared_by,
    (
      select coalesce(p.nickname, p.full_name, 'Hospital Staff')
      from public.profiles p
      where p.id = c.viber_shared_by
    ) as viber_shared_by_name;
end;
$$;

grant execute on function public.set_case_viber_share_status(uuid, boolean) to authenticated;
