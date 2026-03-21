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

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  specialty text not null,
  target_level text not null check (target_level in ('junior', 'senior', 'board', 'mixed')),
  timer_enabled boolean not null default false,
  timer_minutes integer,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references auth.users(id) not null default auth.uid(),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quizzes_window_check check (closes_at > opens_at),
  constraint quizzes_timer_check check (
    (timer_enabled = false and timer_minutes is null)
    or (timer_enabled = true and timer_minutes is not null and timer_minutes > 0)
  )
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade not null,
  sort_order integer not null,
  stem text not null,
  clinical_context text,
  image_url text,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  option_e text,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D', 'E')),
  explanation text,
  teaching_point text,
  pitfall text,
  modality text,
  anatomy_region text,
  difficulty text not null default 'junior' check (difficulty in ('junior', 'senior', 'board')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_questions_option_e_check check (
    correct_option <> 'E' or option_e is not null
  )
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score integer not null default 0,
  total_questions integer not null default 0,
  percentage numeric(5, 2) not null default 0,
  timer_enabled boolean not null default false,
  timer_minutes integer,
  time_spent_seconds integer,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'abandoned')),
  answers jsonb not null default '[]'::jsonb
);

create index if not exists quizzes_status_window_idx on public.quizzes(status, opens_at, closes_at);
create index if not exists quiz_questions_quiz_sort_idx on public.quiz_questions(quiz_id, sort_order);
create index if not exists quiz_attempts_user_quiz_submitted_idx on public.quiz_attempts(user_id, quiz_id, submitted_at desc);

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;

drop policy if exists "Published quizzes are readable by authenticated users" on public.quizzes;
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

drop policy if exists "Quiz authors can insert quizzes" on public.quizzes;
create policy "Quiz authors can insert quizzes"
on public.quizzes
for insert
with check (
  auth.role() = 'authenticated'
  and public.is_quiz_author()
);

drop policy if exists "Quiz authors can update quizzes" on public.quizzes;
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

drop policy if exists "Quiz authors can delete quizzes" on public.quizzes;
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

drop policy if exists "Visible quiz questions can be read" on public.quiz_questions;
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

drop policy if exists "Quiz authors can insert questions" on public.quiz_questions;
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

drop policy if exists "Quiz authors can update questions" on public.quiz_questions;
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

drop policy if exists "Quiz authors can delete questions" on public.quiz_questions;
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

drop policy if exists "Users can read their own attempts" on public.quiz_attempts;
create policy "Users can read their own attempts"
on public.quiz_attempts
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own attempts" on public.quiz_attempts;
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

drop policy if exists "Users can update their own attempts" on public.quiz_attempts;
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
