create extension if not exists pgcrypto;

create or replace function public.is_quiz_author()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'faculty')
  );
$$;

alter table public.quizzes
  alter column questions set default '[]'::jsonb;

alter table public.quizzes
  add column if not exists description text,
  add column if not exists target_level text,
  add column if not exists timer_enabled boolean,
  add column if not exists timer_minutes integer,
  add column if not exists opens_at timestamptz,
  add column if not exists closes_at timestamptz,
  add column if not exists status text,
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz;

update public.quizzes
set
  description = coalesce(description, ''),
  target_level = coalesce(target_level, 'mixed'),
  timer_enabled = coalesce(timer_enabled, false),
  timer_minutes = case when coalesce(timer_enabled, false) then coalesce(timer_minutes, 30) else null end,
  opens_at = coalesce(opens_at, created_at, now()),
  closes_at = coalesce(closes_at, coalesce(created_at, now()) + interval '30 days'),
  status = coalesce(status, 'draft'),
  updated_at = coalesce(updated_at, created_at, now());

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
  coalesce(e.updated_at, e.created_at, now())
from public.quiz_exams e
where not exists (
  select 1 from public.quizzes q where q.id = e.id
);

alter table public.quizzes
  alter column description set default '',
  alter column target_level set default 'mixed',
  alter column timer_enabled set default false,
  alter column status set default 'draft',
  alter column opens_at set default now(),
  alter column closes_at set default (now() + interval '30 days'),
  alter column created_by set default auth.uid(),
  alter column updated_by set default auth.uid(),
  alter column updated_at set default now();

alter table public.quizzes
  alter column description set not null,
  alter column target_level set not null,
  alter column timer_enabled set not null,
  alter column opens_at set not null,
  alter column closes_at set not null,
  alter column status set not null,
  alter column created_by set not null,
  alter column updated_at set not null;

alter table public.quizzes
  drop constraint if exists quizzes_target_level_check,
  drop constraint if exists quizzes_status_check,
  drop constraint if exists quizzes_window_check,
  drop constraint if exists quizzes_timer_check;

alter table public.quizzes
  add constraint quizzes_target_level_check check (target_level in ('junior', 'senior', 'board', 'mixed')),
  add constraint quizzes_status_check check (status in ('draft', 'published', 'archived')),
  add constraint quizzes_window_check check (closes_at > opens_at),
  add constraint quizzes_timer_check check (
    (timer_enabled = false and timer_minutes is null)
    or (timer_enabled = true and timer_minutes is not null and timer_minutes > 0)
  );

alter table public.quiz_questions
  add column if not exists quiz_id uuid references public.quizzes(id) on delete cascade,
  add column if not exists stem text,
  add column if not exists clinical_context text,
  add column if not exists image_url text,
  add column if not exists option_a text,
  add column if not exists option_b text,
  add column if not exists option_c text,
  add column if not exists option_d text,
  add column if not exists option_e text,
  add column if not exists correct_option text,
  add column if not exists teaching_point text,
  add column if not exists pitfall text,
  add column if not exists modality text,
  add column if not exists anatomy_region text,
  add column if not exists difficulty text,
  add column if not exists updated_at timestamptz;

update public.quiz_questions
set
  quiz_id = coalesce(quiz_id, exam_id),
  stem = coalesce(stem, question_text),
  option_a = coalesce(option_a, options->>0),
  option_b = coalesce(option_b, options->>1),
  option_c = coalesce(option_c, options->>2),
  option_d = coalesce(option_d, options->>3),
  option_e = coalesce(option_e, options->>4),
  correct_option = coalesce(
    correct_option,
    case coalesce(correct_answer_index, 0)
      when 0 then 'A'
      when 1 then 'B'
      when 2 then 'C'
      when 3 then 'D'
      when 4 then 'E'
      else 'A'
    end
  ),
  teaching_point = coalesce(teaching_point, ''),
  pitfall = coalesce(pitfall, ''),
  modality = coalesce(modality, ''),
  anatomy_region = coalesce(anatomy_region, ''),
  difficulty = coalesce(difficulty, 'junior'),
  updated_at = coalesce(updated_at, created_at, now());

alter table public.quiz_questions
  alter column sort_order set default 0,
  alter column explanation set default '';

alter table public.quiz_questions
  alter column quiz_id set not null,
  alter column stem set not null,
  alter column option_a set not null,
  alter column option_b set not null,
  alter column option_c set not null,
  alter column option_d set not null,
  alter column correct_option set not null,
  alter column difficulty set not null,
  alter column updated_at set not null;

alter table public.quiz_questions
  drop constraint if exists quiz_questions_correct_option_check,
  drop constraint if exists quiz_questions_difficulty_check,
  drop constraint if exists quiz_questions_option_e_check;

alter table public.quiz_questions
  add constraint quiz_questions_correct_option_check check (correct_option in ('A', 'B', 'C', 'D', 'E')),
  add constraint quiz_questions_difficulty_check check (difficulty in ('junior', 'senior', 'board')),
  add constraint quiz_questions_option_e_check check (correct_option <> 'E' or option_e is not null);

alter table public.quiz_attempts
  add column if not exists quiz_id uuid references public.quizzes(id) on delete cascade,
  add column if not exists submitted_at timestamptz,
  add column if not exists total_questions integer,
  add column if not exists percentage numeric(5,2),
  add column if not exists timer_enabled boolean,
  add column if not exists timer_minutes integer,
  add column if not exists time_spent_seconds integer,
  add column if not exists status text;

update public.quiz_attempts
set
  quiz_id = coalesce(quiz_id, exam_id),
  submitted_at = coalesce(submitted_at, completed_at),
  total_questions = coalesce(total_questions, correct_count, 0),
  percentage = coalesce(
    percentage,
    case
      when coalesce(total_points, 0) > 0 then round((score::numeric / total_points::numeric) * 100, 2)
      when coalesce(correct_count, 0) > 0 then round((score::numeric / correct_count::numeric) * 100, 2)
      else 0
    end
  ),
  timer_enabled = coalesce(timer_enabled, false),
  timer_minutes = coalesce(timer_minutes, null),
  time_spent_seconds = coalesce(time_spent_seconds, duration_seconds),
  status = coalesce(status, 'submitted'),
  answers = case
    when jsonb_typeof(answers) = 'array' then answers
    when answers = '{}'::jsonb then '[]'::jsonb
    else '[]'::jsonb
  end;

alter table public.quiz_attempts
  alter column answers set default '[]'::jsonb,
  alter column total_questions set default 0,
  alter column percentage set default 0,
  alter column timer_enabled set default false,
  alter column status set default 'in_progress';

alter table public.quiz_attempts
  alter column quiz_id set not null,
  alter column total_questions set not null,
  alter column percentage set not null,
  alter column timer_enabled set not null,
  alter column status set not null;

alter table public.quiz_attempts
  drop constraint if exists quiz_attempts_status_check;

alter table public.quiz_attempts
  add constraint quiz_attempts_status_check check (status in ('in_progress', 'submitted', 'abandoned'));

create index if not exists quizzes_status_window_idx on public.quizzes(status, opens_at, closes_at);
create index if not exists quiz_questions_quiz_sort_idx on public.quiz_questions(quiz_id, sort_order);
create index if not exists quiz_attempts_user_quiz_submitted_idx on public.quiz_attempts(user_id, quiz_id, submitted_at desc);

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;

drop policy if exists "Quizzes are viewable by everyone." on public.quizzes;
drop policy if exists "Published quizzes are readable by authenticated users" on public.quizzes;
drop policy if exists "Quiz authors can insert quizzes" on public.quizzes;
drop policy if exists "Quiz authors can update quizzes" on public.quizzes;
drop policy if exists "Quiz authors can delete quizzes" on public.quizzes;

create policy "Published quizzes are readable by authenticated users"
on public.quizzes
for select
using (
  auth.role() = 'authenticated'
  and (
    status = 'published'
    or created_by = auth.uid()
    or public.is_quiz_author()
  )
);

create policy "Quiz authors can insert quizzes"
on public.quizzes
for insert
with check (
  auth.role() = 'authenticated'
  and public.is_quiz_author()
);

create policy "Quiz authors can update quizzes"
on public.quizzes
for update
using (
  auth.role() = 'authenticated'
  and (
    public.is_admin()
    or (public.is_quiz_author() and created_by = auth.uid())
  )
)
with check (
  auth.role() = 'authenticated'
  and (
    public.is_admin()
    or (public.is_quiz_author() and created_by = auth.uid())
  )
);

create policy "Quiz authors can delete quizzes"
on public.quizzes
for delete
using (
  auth.role() = 'authenticated'
  and (
    public.is_admin()
    or (public.is_quiz_author() and created_by = auth.uid())
  )
);

drop policy if exists "quiz_questions_delete_author_or_privileged" on public.quiz_questions;
drop policy if exists "quiz_questions_insert_author_or_privileged" on public.quiz_questions;
drop policy if exists "quiz_questions_select_published_or_author_or_privileged" on public.quiz_questions;
drop policy if exists "quiz_questions_update_author_or_privileged" on public.quiz_questions;
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
    where q.id = quiz_questions.quiz_id
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
    where q.id = quiz_questions.quiz_id
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
    where q.id = quiz_questions.quiz_id
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
    where q.id = quiz_questions.quiz_id
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
    where q.id = quiz_questions.quiz_id
      and (
        public.is_admin()
        or (public.is_quiz_author() and q.created_by = auth.uid())
      )
  )
);

drop policy if exists "quiz_attempts_select_own_or_author_or_privileged" on public.quiz_attempts;
drop policy if exists "Users can read their own attempts" on public.quiz_attempts;
drop policy if exists "Users can insert their own attempts" on public.quiz_attempts;
drop policy if exists "Users can update their own attempts" on public.quiz_attempts;

create policy "Users can read their own attempts"
on public.quiz_attempts
for select
using (auth.uid() = user_id);

create policy "Users can insert their own attempts"
on public.quiz_attempts
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.quizzes q
    where q.id = quiz_attempts.quiz_id
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

create or replace view public.quiz_attempt_summaries as
select
  qa.id,
  qa.quiz_id,
  qa.user_id,
  qa.started_at,
  qa.submitted_at,
  qa.score,
  qa.total_questions,
  qa.percentage,
  qa.timer_enabled,
  qa.timer_minutes,
  qa.time_spent_seconds,
  qa.status,
  qa.answers,
  q.title,
  q.specialty,
  q.target_level,
  q.opens_at,
  q.closes_at,
  q.status as quiz_status,
  q.created_by
from public.quiz_attempts qa
join public.quizzes q on q.id = qa.quiz_id
where qa.user_id = auth.uid();

create or replace function public.ensure_quiz_exam_id()
returns trigger
language plpgsql
as $$
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_quiz_exam_id on public.quiz_exams;
create trigger set_quiz_exam_id
before insert on public.quiz_exams
for each row
execute function public.ensure_quiz_exam_id();
