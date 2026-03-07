alter table public.pathology_guideline_versions
  add column if not exists origin text not null default 'manual_edit'
  check (origin in ('pdf_json_import', 'manual_edit', 'drive_sync', 'draft_clone'));

update public.pathology_guideline_versions
set origin = case
  when coalesce(source_revision, '') <> '' then 'drive_sync'
  else 'manual_edit'
end
where origin is null
   or origin = ''
   or origin = 'manual_edit';
