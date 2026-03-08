drop policy if exists "pathology_guideline_requests_delete_scoped" on public.pathology_guideline_requests;
create policy "pathology_guideline_requests_delete_scoped"
on public.pathology_guideline_requests
for delete
to authenticated
using (
  created_by = auth.uid()
  or public.current_user_can_edit_pathology_guidelines()
);
