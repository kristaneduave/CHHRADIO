drop policy if exists "Users can insert their own attempts" on public.quiz_attempts;
drop policy if exists "Users can update their own attempts" on public.quiz_attempts;

create policy "Users can insert their own attempts"
on public.quiz_attempts
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.quizzes q
    where q.id = coalesce(quiz_attempts.quiz_id, quiz_attempts.exam_id)
      and q.status = 'published'
      and now() >= q.opens_at
      and now() < q.closes_at
  )
);

create policy "Users can update their own attempts"
on public.quiz_attempts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.sync_legacy_quiz_attempt_shape()
returns trigger
language plpgsql
as $$
declare
  resolved_quiz_id uuid;
  resolved_total_questions integer;
begin
  resolved_quiz_id := coalesce(new.quiz_id, new.exam_id);
  new.quiz_id := resolved_quiz_id;

  if new.answers is null or jsonb_typeof(new.answers) <> 'array' then
    new.answers := '[]'::jsonb;
  end if;

  select count(*)
  into resolved_total_questions
  from public.quiz_questions qq
  where qq.quiz_id = resolved_quiz_id
     or qq.exam_id = resolved_quiz_id;

  new.total_questions := coalesce(new.total_questions, resolved_total_questions, 0);
  new.submitted_at := coalesce(new.submitted_at, new.completed_at);
  new.time_spent_seconds := coalesce(new.time_spent_seconds, new.duration_seconds, 0);
  new.timer_enabled := coalesce(new.timer_enabled, false);
  new.status := coalesce(new.status, case when new.submitted_at is null then 'in_progress' else 'submitted' end);

  if new.percentage is null then
    if coalesce(new.total_questions, 0) > 0 then
      new.percentage := round((coalesce(new.score, 0)::numeric / new.total_questions::numeric) * 100, 2);
    else
      new.percentage := 0;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_legacy_quiz_attempt_shape on public.quiz_attempts;
create trigger sync_legacy_quiz_attempt_shape
before insert or update on public.quiz_attempts
for each row
execute function public.sync_legacy_quiz_attempt_shape();
