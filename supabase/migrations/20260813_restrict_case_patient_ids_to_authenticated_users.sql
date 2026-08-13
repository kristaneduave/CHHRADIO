begin;

-- Published cases are available inside the registered-user portal, but should not
-- be directly enumerable through the anonymous REST API.
drop policy if exists "Users can view published cases or own drafts" on public.cases;

create policy "Authenticated users can view published cases or own drafts"
on public.cases
for select
to authenticated
using (
  status = 'published'
  or auth.uid() = created_by
);

revoke select on table public.cases from anon;
grant select on table public.cases to authenticated;

-- Anonymous viewers browse published cases through this function. It returns the
-- same case shape expected by the app, but removes patient identifiers from the
-- nested analysis_result object unless the caller is authenticated.
create or replace function public.list_published_cases_for_viewer()
returns setof public.cases
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_populate_record(
    null::public.cases,
    to_jsonb(c) || jsonb_build_object(
      'analysis_result',
      case
        when auth.role() = 'authenticated' then c.analysis_result
        else coalesce(c.analysis_result, '{}'::jsonb) - 'patientId' - 'patient_id'
      end
    )
  )
  from public.cases c
  where c.status = 'published'
  order by c.created_at desc;
$$;

revoke all on function public.list_published_cases_for_viewer() from public;
grant execute on function public.list_published_cases_for_viewer() to anon, authenticated;

-- Public share links still resolve for anonymous viewers, but their copy of the
-- case record must not contain a PACS patient identifier. Authenticated viewers
-- retain the original analysis_result object.
create or replace function public.resolve_public_case_by_token(p_public_token uuid)
returns setof public.cases
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_populate_record(
    null::public.cases,
    to_jsonb(c) || jsonb_build_object(
      'analysis_result',
      case
        when auth.role() = 'authenticated' then c.analysis_result
        else coalesce(c.analysis_result, '{}'::jsonb) - 'patientId' - 'patient_id'
      end
    )
  )
  from public.case_shares shares
  join public.cases c on c.id = shares.case_id
  where shares.public_token = p_public_token
    and shares.is_active = true
    and shares.revoked_at is null
    and c.status = 'published'
  limit 1;
$$;

revoke all on function public.resolve_public_case_by_token(uuid) from public;
grant execute on function public.resolve_public_case_by_token(uuid) to anon, authenticated;

commit;
