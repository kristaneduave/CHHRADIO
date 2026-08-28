begin;

-- Viber delivery is an internal workflow signal. Anonymous viewers can still
-- browse published cases, but the delivery timestamp and staff id stay private.
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
      end,
      'viber_shared_at',
      case when auth.role() = 'authenticated' then to_jsonb(c.viber_shared_at) else 'null'::jsonb end,
      'viber_shared_by',
      case when auth.role() = 'authenticated' then to_jsonb(c.viber_shared_by) else 'null'::jsonb end
    )
  )
  from public.cases c
  where c.status = 'published'
  order by c.created_at desc;
$$;

revoke all on function public.list_published_cases_for_viewer() from public;
grant execute on function public.list_published_cases_for_viewer() to anon, authenticated;

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
      end,
      'viber_shared_at',
      case when auth.role() = 'authenticated' then to_jsonb(c.viber_shared_at) else 'null'::jsonb end,
      'viber_shared_by',
      case when auth.role() = 'authenticated' then to_jsonb(c.viber_shared_by) else 'null'::jsonb end
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
