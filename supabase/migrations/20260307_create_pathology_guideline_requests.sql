create table if not exists public.pathology_guideline_requests (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  request_type text not null check (request_type in ('topic', 'pdf_source', 'guideline_update')),
  title text not null check (char_length(trim(title)) >= 3),
  description text null,
  source_url text null,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'approved', 'rejected', 'completed')),
  review_notes text null,
  fulfilled_guideline_id uuid null references public.pathology_guidelines(id) on delete set null,
  reviewed_by uuid null references public.profiles(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pathology_guideline_requests_status_created_at
  on public.pathology_guideline_requests (status, created_at desc);

create index if not exists idx_pathology_guideline_requests_created_by
  on public.pathology_guideline_requests (created_by, created_at desc);

create or replace function public.set_pathology_guideline_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if auth.uid() is not null and public.current_user_can_edit_pathology_guidelines() then
    if new.status is distinct from old.status or new.review_notes is distinct from old.review_notes then
      new.reviewed_by = auth.uid();
      new.reviewed_at = now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_pathology_guideline_requests_updated_at on public.pathology_guideline_requests;
create trigger trg_set_pathology_guideline_requests_updated_at
before update on public.pathology_guideline_requests
for each row execute function public.set_pathology_guideline_requests_updated_at();

alter table public.pathology_guideline_requests enable row level security;

drop policy if exists "pathology_guideline_requests_insert_authenticated" on public.pathology_guideline_requests;
create policy "pathology_guideline_requests_insert_authenticated"
on public.pathology_guideline_requests
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "pathology_guideline_requests_select_scoped" on public.pathology_guideline_requests;
create policy "pathology_guideline_requests_select_scoped"
on public.pathology_guideline_requests
for select
to authenticated
using (
  created_by = auth.uid()
  or public.current_user_can_edit_pathology_guidelines()
);

drop policy if exists "pathology_guideline_requests_update_privileged" on public.pathology_guideline_requests;
create policy "pathology_guideline_requests_update_privileged"
on public.pathology_guideline_requests
for update
to authenticated
using (public.current_user_can_edit_pathology_guidelines())
with check (public.current_user_can_edit_pathology_guidelines());
