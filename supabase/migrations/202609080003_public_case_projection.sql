begin;
-- API accounts without a valid staff profile must not bypass the public projection.
alter table public.cases enable row level security;
revoke select on public.cases from public, anon;
create policy cases_staff_read_fence on public.cases as restrictive for select to public
using (public.current_user_is_staff());
create or replace function public.public_case_reference(value jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('sourceType',value->>'sourceType','title',value->>'title','page',value->>'page');
$$;
revoke all on function public.public_case_reference(jsonb) from public, anon, authenticated;

create or replace function public.public_case_projection(c public.cases)
returns public.cases language sql immutable set search_path = public as $$
  select jsonb_populate_record(null::public.cases, jsonb_build_object(
    'id',c.id,'title',c.title,'status',c.status,'created_at',c.created_at,
    'submission_type',c.submission_type,'modality',c.modality,'organ_system',c.organ_system,
    'diagnosis',c.diagnosis,'clinical_history',c.clinical_history,'findings',c.findings,
    'educational_summary',c.educational_summary,'radiologic_clinchers',c.radiologic_clinchers,
    'image_url',c.image_url,'image_urls',c.image_urls,
    'analysis_result',jsonb_build_object(
      'impression',c.analysis_result->>'impression',
      'educationalSummary',c.analysis_result->>'educationalSummary',
      'keyFindings',coalesce((select jsonb_agg(value) from jsonb_array_elements(
        case when jsonb_typeof(c.analysis_result->'keyFindings') = 'array'
        then c.analysis_result->'keyFindings' else '[]'::jsonb end) where jsonb_typeof(value) = 'string'),'[]'::jsonb),
      'imagesMetadata',coalesce((select jsonb_agg(jsonb_build_object('description',value->>'description'))
        from jsonb_array_elements(case when jsonb_typeof(c.analysis_result->'imagesMetadata') = 'array'
        then c.analysis_result->'imagesMetadata' else '[]'::jsonb end)),'[]'::jsonb),
      'references',coalesce((select jsonb_agg(public.public_case_reference(value))
        from jsonb_array_elements(case when jsonb_typeof(c.analysis_result->'references') = 'array'
        then c.analysis_result->'references' else '[]'::jsonb end)),'[]'::jsonb),
      'reference',case when jsonb_typeof(c.analysis_result->'reference') = 'object'
        then public.public_case_reference(c.analysis_result->'reference') else null end
    )
  ));
$$;
revoke all on function public.public_case_projection(public.cases) from public, anon, authenticated;

create or replace function public.list_published_cases_for_viewer()
returns setof public.cases language sql stable security definer set search_path = public as $$
  select case when public.current_user_is_staff() then c else public.public_case_projection(c) end
  from public.cases c where c.status = 'published' order by c.created_at desc;
$$;
revoke all on function public.list_published_cases_for_viewer() from public;
grant execute on function public.list_published_cases_for_viewer() to anon, authenticated;

create or replace function public.resolve_public_case_by_token(p_public_token uuid)
returns setof public.cases language sql stable security definer set search_path = public as $$
  select public.public_case_projection(c)
  from public.case_shares s join public.cases c on c.id = s.case_id
  where s.public_token = p_public_token and s.is_active and s.revoked_at is null and c.status = 'published'
  limit 1;
$$;
revoke all on function public.resolve_public_case_by_token(uuid) from public;
grant execute on function public.resolve_public_case_by_token(uuid) to anon, authenticated;
commit;
