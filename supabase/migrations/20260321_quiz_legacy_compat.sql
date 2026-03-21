drop policy if exists "Visible quiz questions can be read" on public.quiz_questions;
drop policy if exists "Quiz authors can insert questions" on public.quiz_questions;
drop policy if exists "Quiz authors can update questions" on public.quiz_questions;
drop policy if exists "Quiz authors can delete questions" on public.quiz_questions;

create policy "Visible quiz questions can be read"
on public.quiz_questions
for select
using (
  exists (
    select 1
    from public.quizzes q
    where q.id = coalesce(quiz_questions.quiz_id, quiz_questions.exam_id)
      and (
        q.created_by = auth.uid()
        or public.is_quiz_author()
        or (
          q.status = 'published'
          and now() >= q.opens_at
          and now() < q.closes_at
        )
      )
  )
);

create policy "Quiz authors can insert questions"
on public.quiz_questions
for insert
with check (
  exists (
    select 1
    from public.quizzes q
    where q.id = coalesce(quiz_questions.quiz_id, quiz_questions.exam_id)
      and (
        public.is_admin()
        or (public.is_quiz_author() and q.created_by = auth.uid())
      )
  )
);

create policy "Quiz authors can update questions"
on public.quiz_questions
for update
using (
  exists (
    select 1
    from public.quizzes q
    where q.id = coalesce(quiz_questions.quiz_id, quiz_questions.exam_id)
      and (
        public.is_admin()
        or (public.is_quiz_author() and q.created_by = auth.uid())
      )
  )
)
with check (
  exists (
    select 1
    from public.quizzes q
    where q.id = coalesce(quiz_questions.quiz_id, quiz_questions.exam_id)
      and (
        public.is_admin()
        or (public.is_quiz_author() and q.created_by = auth.uid())
      )
  )
);

create policy "Quiz authors can delete questions"
on public.quiz_questions
for delete
using (
  exists (
    select 1
    from public.quizzes q
    where q.id = coalesce(quiz_questions.quiz_id, quiz_questions.exam_id)
      and (
        public.is_admin()
        or (public.is_quiz_author() and q.created_by = auth.uid())
      )
  )
);

create or replace function public.sync_legacy_quiz_exam_to_quizzes()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.quizzes where id = old.id;
    return old;
  end if;

  insert into public.quizzes (
    id,
    title,
    questions,
    specialty,
    description,
    target_level,
    timer_enabled,
    timer_minutes,
    opens_at,
    closes_at,
    status,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.title,
    '[]'::jsonb,
    new.specialty,
    coalesce(new.description, ''),
    'mixed',
    false,
    null,
    coalesce(new.created_at, now()),
    coalesce(new.created_at, now()) + interval '30 days',
    case
      when new.status in ('draft', 'published', 'archived') then new.status
      when new.is_published then 'published'
      else 'draft'
    end,
    new.created_by,
    new.created_by,
    coalesce(new.created_at, now()),
    coalesce(new.updated_at, now())
  )
  on conflict (id) do update
  set
    title = excluded.title,
    specialty = excluded.specialty,
    description = excluded.description,
    status = excluded.status,
    created_by = excluded.created_by,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists sync_legacy_quiz_exam_to_quizzes on public.quiz_exams;
create trigger sync_legacy_quiz_exam_to_quizzes
after insert or update or delete on public.quiz_exams
for each row
execute function public.sync_legacy_quiz_exam_to_quizzes();

create or replace function public.sync_legacy_quiz_question_shape()
returns trigger
language plpgsql
as $$
begin
  new.quiz_id := coalesce(new.quiz_id, new.exam_id);
  new.stem := coalesce(new.stem, new.question_text);

  if new.options is not null and jsonb_typeof(new.options) = 'array' then
    new.option_a := coalesce(new.option_a, new.options->>0);
    new.option_b := coalesce(new.option_b, new.options->>1);
    new.option_c := coalesce(new.option_c, new.options->>2);
    new.option_d := coalesce(new.option_d, new.options->>3);
    new.option_e := coalesce(new.option_e, new.options->>4);
  end if;

  if new.correct_option is null then
    new.correct_option := case coalesce(new.correct_answer_index, 0)
      when 0 then 'A'
      when 1 then 'B'
      when 2 then 'C'
      when 3 then 'D'
      when 4 then 'E'
      else 'A'
    end;
  end if;

  new.teaching_point := coalesce(new.teaching_point, '');
  new.pitfall := coalesce(new.pitfall, '');
  new.modality := coalesce(new.modality, '');
  new.anatomy_region := coalesce(new.anatomy_region, '');
  new.difficulty := coalesce(new.difficulty, 'junior');
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists sync_legacy_quiz_question_shape on public.quiz_questions;
create trigger sync_legacy_quiz_question_shape
before insert or update on public.quiz_questions
for each row
execute function public.sync_legacy_quiz_question_shape();

insert into public.quizzes (
  id,
  title,
  questions,
  specialty,
  description,
  target_level,
  timer_enabled,
  timer_minutes,
  opens_at,
  closes_at,
  status,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  e.id,
  e.title,
  '[]'::jsonb,
  e.specialty,
  coalesce(e.description, ''),
  'mixed',
  false,
  null,
  coalesce(e.created_at, now()),
  coalesce(e.created_at, now()) + interval '30 days',
  case
    when e.status in ('draft', 'published', 'archived') then e.status
    when e.is_published then 'published'
    else 'draft'
  end,
  e.created_by,
  e.created_by,
  coalesce(e.created_at, now()),
  coalesce(e.updated_at, now())
from public.quiz_exams e
where not exists (
  select 1 from public.quizzes q where q.id = e.id
);
