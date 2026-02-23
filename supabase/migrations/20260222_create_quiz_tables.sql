-- Quiz feature: exam authoring (training officers) and attempts (all users)
create extension if not exists pgcrypto;

create table if not exists public.quiz_exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  specialty text not null,
  description text,
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  is_published boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.quiz_exams(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'mcq' check (question_type in ('mcq', 'image')),
  image_url text,
  options jsonb not null default '[]'::jsonb,
  correct_answer_index integer not null check (correct_answer_index >= 0),
  explanation text,
  points integer not null default 1 check (points > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.quiz_exams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  score integer not null default 0,
  total_points integer not null default 0,
  correct_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create index if not exists idx_quiz_exams_created_by on public.quiz_exams(created_by);
create index if not exists idx_quiz_exams_published on public.quiz_exams(is_published, specialty);
create index if not exists idx_quiz_questions_exam_id on public.quiz_questions(exam_id, sort_order);
create index if not exists idx_quiz_attempts_user_id on public.quiz_attempts(user_id, completed_at desc);

alter table public.quiz_exams enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;

-- Exams: everyone can read published exams; creators can read/write their own exams.
create policy "quiz_exams_select_published_or_owner"
on public.quiz_exams
for select
to authenticated
using (is_published = true or created_by = auth.uid());

create policy "quiz_exams_insert_owner"
on public.quiz_exams
for insert
to authenticated
with check (created_by = auth.uid());

create policy "quiz_exams_update_owner"
on public.quiz_exams
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "quiz_exams_delete_owner"
on public.quiz_exams
for delete
to authenticated
using (created_by = auth.uid());

-- Questions: visible when exam is published or owned by current user; editable by exam owner.
create policy "quiz_questions_select_published_or_owner"
on public.quiz_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.quiz_exams e
    where e.id = quiz_questions.exam_id
      and (e.is_published = true or e.created_by = auth.uid())
  )
);

create policy "quiz_questions_insert_owner"
on public.quiz_questions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.quiz_exams e
    where e.id = quiz_questions.exam_id
      and e.created_by = auth.uid()
  )
);

create policy "quiz_questions_update_owner"
on public.quiz_questions
for update
to authenticated
using (
  exists (
    select 1
    from public.quiz_exams e
    where e.id = quiz_questions.exam_id
      and e.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.quiz_exams e
    where e.id = quiz_questions.exam_id
      and e.created_by = auth.uid()
  )
);

create policy "quiz_questions_delete_owner"
on public.quiz_questions
for delete
to authenticated
using (
  exists (
    select 1
    from public.quiz_exams e
    where e.id = quiz_questions.exam_id
      and e.created_by = auth.uid()
  )
);

-- Attempts: users can insert/view only their own attempts.
create policy "quiz_attempts_select_own"
on public.quiz_attempts
for select
to authenticated
using (user_id = auth.uid());

create policy "quiz_attempts_insert_own"
on public.quiz_attempts
for insert
to authenticated
with check (user_id = auth.uid());
