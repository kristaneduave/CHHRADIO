begin;

alter table public.account_access_requests
  add column if not exists claimed_by uuid null,
  add column if not exists claimed_at timestamptz null;

alter table public.account_access_requests
  drop constraint if exists account_access_requests_claimed_by_fkey;

create index if not exists idx_account_access_requests_approved_email
  on public.account_access_requests (lower(email), reviewed_at desc)
  where status = 'approved';

-- Public applicants may create pending requests only. Review fields cannot be
-- forged to bypass staff approval.
drop policy if exists "account_access_requests_insert_public" on public.account_access_requests;
create policy "account_access_requests_insert_public"
on public.account_access_requests
for insert
to anon, authenticated
with check (
  status = 'pending'
  and admin_notes is null
  and reviewed_by is null
  and reviewed_at is null
  and claimed_by is null
  and claimed_at is null
);

-- Staff may read applications, but all review writes go through the narrow RPC
-- below so protected claim fields cannot be changed through the table API.
drop policy if exists "account_access_requests_admin_select" on public.account_access_requests;
drop policy if exists "account_access_requests_admin_update" on public.account_access_requests;
drop policy if exists "account_access_requests_manage_multi_role_privileged" on public.account_access_requests;
create policy "account_access_requests_staff_select"
on public.account_access_requests
for select
to authenticated
using (
  public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
);

create or replace function public.review_account_access_request(
  p_request_id uuid,
  p_status text,
  p_admin_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_has_any_role(array['admin', 'moderator', 'training_officer']) then
    raise exception 'Only authorized staff can review access requests.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Review status must be approved or rejected.';
  end if;

  update public.account_access_requests
  set status = p_status,
      admin_notes = nullif(trim(p_admin_notes), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id
    and status = 'pending';

  if not found then
    raise exception 'This request is no longer pending.';
  end if;
end;
$$;

revoke all on function public.review_account_access_request(uuid, text, text) from public;
grant execute on function public.review_account_access_request(uuid, text, text) to authenticated;

-- Configure this function as Authentication > Hooks > Before User Created.
-- It rejects password and OAuth signups unless staff approved the email first.
create or replace function public.hook_require_approved_access_request(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  applicant_email text := lower(trim(event->'user'->>'email'));
  applicant_id uuid := (event->'user'->>'id')::uuid;
  approved_request_id uuid;
begin
  if applicant_email = '' or applicant_id is null then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'A staff-approved email address is required.'
      )
    );
  end if;

  select r.id
  into approved_request_id
    from public.account_access_requests r
    where lower(r.email) = applicant_email
      and r.status = 'approved'
      and (r.claimed_by is null or r.claimed_by = applicant_id)
    order by r.reviewed_at desc nulls last, r.created_at desc
    limit 1
    for update;

  if approved_request_id is not null then
    update public.account_access_requests
    set claimed_by = applicant_id,
        claimed_at = coalesce(claimed_at, now())
    where id = approved_request_id;

    return event;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Staff approval is required before registration.'
    )
  );
end;
$$;

grant execute on function public.hook_require_approved_access_request(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_require_approved_access_request(jsonb) from anon, authenticated, public;

-- Profile activation uses the approved request as the source of truth for role.
create or replace function public.complete_approved_profile(
  p_full_name text,
  p_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text := lower(trim(coalesce(auth.jwt()->>'email', '')));
  approved_request public.account_access_requests%rowtype;
  safe_username text;
  result_profile public.profiles%rowtype;
begin
  if caller_id is null or caller_email = '' then
    raise exception 'Authentication is required.';
  end if;

  if char_length(trim(p_full_name)) < 2 or char_length(trim(p_display_name)) < 1 then
    raise exception 'Full name and display name are required.';
  end if;

  select r.*
  into approved_request
  from public.account_access_requests r
  where lower(r.email) = caller_email
    and r.status = 'approved'
    and (r.claimed_by is null or r.claimed_by = caller_id)
  order by r.reviewed_at desc nulls last, r.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No approved staff access request was found for this email.';
  end if;

  safe_username := lower(regexp_replace(split_part(caller_email, '@', 1), '[^a-zA-Z0-9_]+', '', 'g'))
    || '_' || substr(caller_id::text, 1, 8);

  insert into public.profiles (
    id,
    full_name,
    nickname,
    username,
    role,
    year_level,
    updated_at
  ) values (
    caller_id,
    trim(p_full_name),
    trim(p_display_name),
    safe_username,
    approved_request.requested_role,
    approved_request.year_level,
    now()
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    nickname = excluded.nickname,
    role = excluded.role,
    year_level = excluded.year_level,
    updated_at = now()
  returning * into result_profile;

  update public.account_access_requests
  set claimed_by = caller_id,
      claimed_at = coalesce(claimed_at, now())
  where id = approved_request.id;

  return jsonb_build_object(
    'id', result_profile.id,
    'full_name', result_profile.full_name,
    'nickname', result_profile.nickname,
    'role', result_profile.role,
    'year_level', result_profile.year_level
  );
end;
$$;

revoke all on function public.complete_approved_profile(text, text) from public;
grant execute on function public.complete_approved_profile(text, text) to authenticated;

-- A user cannot bypass the activation RPC by inserting a different role.
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Approved users can insert own profile" on public.profiles;
create policy "Approved users can insert own profile"
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and exists (
    select 1
    from public.account_access_requests r
    where lower(r.email) = lower(trim(coalesce(auth.jwt()->>'email', '')))
      and r.status = 'approved'
      and r.requested_role = profiles.role
      and (r.claimed_by is null or r.claimed_by = auth.uid())
  )
);

create or replace function public.prevent_unapproved_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id
    and new.role is distinct from old.role
    and not public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
    and not exists (
      select 1
      from public.account_access_requests r
      where lower(r.email) = lower(trim(coalesce(auth.jwt()->>'email', '')))
        and r.status = 'approved'
        and r.requested_role = new.role
        and (r.claimed_by is null or r.claimed_by = auth.uid())
    ) then
    raise exception 'Only authorized staff can change account roles.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_unapproved_profile_role_change on public.profiles;
create trigger trg_prevent_unapproved_profile_role_change
before update of role on public.profiles
for each row execute function public.prevent_unapproved_profile_role_change();

revoke execute on function public.prevent_unapproved_profile_role_change() from public, anon, authenticated;

commit;
