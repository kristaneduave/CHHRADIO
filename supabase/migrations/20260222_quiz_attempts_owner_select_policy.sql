-- Allow exam owners (e.g. training officers/admins) to view attempts for their exams.
create policy "quiz_attempts_select_exam_owner"
on public.quiz_attempts
for select
to authenticated
using (
  exists (
    select 1
    from public.quiz_exams e
    where e.id = quiz_attempts.exam_id
      and e.created_by = auth.uid()
  )
);
