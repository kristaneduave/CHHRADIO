alter table public.pathology_guidelines
  add column if not exists primary_topic text null;

alter table public.pathology_guidelines
  add column if not exists secondary_topics text[] not null default '{}'::text[];

alter table public.pathology_guidelines
  add column if not exists clinical_tags text[] not null default '{}'::text[];

alter table public.pathology_guidelines
  add column if not exists anatomy_terms text[] not null default '{}'::text[];

alter table public.pathology_guidelines
  add column if not exists problem_terms text[] not null default '{}'::text[];

alter table public.pathology_guidelines
  add column if not exists content_type text not null default 'checklist';

alter table public.pathology_guidelines
  add column if not exists is_featured boolean not null default false;

alter table public.pathology_guidelines
  add column if not exists search_priority integer not null default 0;

alter table public.pathology_guidelines
  add column if not exists related_guideline_slugs text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pathology_guidelines_content_type_check'
  ) then
    alter table public.pathology_guidelines
      add constraint pathology_guidelines_content_type_check
      check (content_type in ('checklist', 'guideline', 'review'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pathology_guidelines_search_priority_check'
  ) then
    alter table public.pathology_guidelines
      add constraint pathology_guidelines_search_priority_check
      check (search_priority >= 0);
  end if;
end $$;

create index if not exists idx_pathology_guidelines_active_topic_name
  on public.pathology_guidelines (is_active, primary_topic, pathology_name);

create index if not exists idx_pathology_guidelines_secondary_topics_gin
  on public.pathology_guidelines using gin (secondary_topics);

create index if not exists idx_pathology_guidelines_clinical_tags_gin
  on public.pathology_guidelines using gin (clinical_tags);

create index if not exists idx_pathology_guidelines_anatomy_terms_gin
  on public.pathology_guidelines using gin (anatomy_terms);

create index if not exists idx_pathology_guidelines_problem_terms_gin
  on public.pathology_guidelines using gin (problem_terms);

drop view if exists public.pathology_guideline_current;
create or replace view public.pathology_guideline_current as
select
  g.id as guideline_id,
  g.slug,
  g.pathology_name,
  g.specialty,
  g.synonyms,
  g.keywords,
  g.primary_topic,
  g.secondary_topics,
  g.clinical_tags,
  g.anatomy_terms,
  g.problem_terms,
  g.content_type,
  g.is_featured,
  g.search_priority,
  g.related_guideline_slugs,
  g.source_kind,
  coalesce(v.source_url, g.source_url, g.google_drive_url) as source_url,
  g.google_drive_url,
  v.id as version_id,
  v.version_label,
  v.effective_date,
  coalesce(v.source_title, g.source_title) as source_title,
  coalesce(v.issuing_body, g.issuing_body) as issuing_body,
  v.tldr_md,
  v.rich_summary_md,
  v.reporting_takeaways,
  v.reporting_red_flags,
  v.suggested_report_phrases,
  v.checklist_items,
  v.parse_notes,
  v.raw_text_excerpt,
  v.synced_at,
  v.published_at
from public.pathology_guidelines g
join lateral (
  select pv.*
  from public.pathology_guideline_versions pv
  where pv.guideline_id = g.id
    and pv.sync_status = 'published'
  order by pv.effective_date desc nulls last, pv.published_at desc nulls last, pv.synced_at desc
  limit 1
) v on true
where g.is_active = true;

grant select on public.pathology_guideline_current to authenticated;
