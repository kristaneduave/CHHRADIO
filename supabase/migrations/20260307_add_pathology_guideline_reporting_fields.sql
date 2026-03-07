alter table public.pathology_guideline_versions
  add column if not exists tldr_md text not null default '';

alter table public.pathology_guideline_versions
  add column if not exists reporting_takeaways jsonb not null default '[]'::jsonb;

alter table public.pathology_guideline_versions
  add column if not exists reporting_red_flags jsonb not null default '[]'::jsonb;

alter table public.pathology_guideline_versions
  add column if not exists suggested_report_phrases jsonb not null default '[]'::jsonb;

drop view if exists public.pathology_guideline_current;
create or replace view public.pathology_guideline_current as
select
  g.id as guideline_id,
  g.slug,
  g.pathology_name,
  g.specialty,
  g.synonyms,
  g.keywords,
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
