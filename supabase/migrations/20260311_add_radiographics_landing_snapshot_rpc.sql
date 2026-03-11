create or replace function public.get_radiographics_landing_snapshot()
returns table (
  guideline_id uuid,
  slug text,
  pathology_name text,
  specialty text,
  primary_topic text,
  secondary_topics text[],
  clinical_tags text[],
  anatomy_terms text[],
  problem_terms text[],
  is_featured boolean,
  search_priority integer,
  effective_date date,
  published_at timestamptz,
  source_kind text,
  tldr_md text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    current.guideline_id,
    current.slug,
    current.pathology_name,
    current.specialty,
    current.primary_topic,
    current.secondary_topics,
    current.clinical_tags,
    current.anatomy_terms,
    current.problem_terms,
    current.is_featured,
    current.search_priority,
    current.effective_date,
    current.published_at,
    current.source_kind,
    current.tldr_md
  from public.pathology_guideline_current current
  order by current.pathology_name asc;
$$;

grant execute on function public.get_radiographics_landing_snapshot() to authenticated;
