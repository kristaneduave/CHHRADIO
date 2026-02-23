-- Quiz revamp: authoring permissions, server-side submission, detailed analytics
create extension if not exists pgcrypto;

alter table public.quiz_exams
  add column if not exists pass_mark_percent integer not null default 70 check (pass_mark_percent between 1 and 100),
  add column if not exists status text not null default 'draft' check (status in ('draft', 'published', 'archived'));

update public.quiz_exams
set status = case when is_published then 'published' else 'draft' end
where status not in ('draft', 'published', 'archived');

create or replace function public.sync_quiz_exam_publish_state()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' then
    new.is_published := true;
  elsif new.status in ('draft', 'archived') then
    new.is_published := false;
  elsif new.is_published = true then
    new.status := 'published';
  else
    new.status := 'draft';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_sync_quiz_exam_publish_state on public.quiz_exams;
create trigger trg_sync_quiz_exam_publish_state
before insert or update on public.quiz_exams
for each row
execute function public.sync_quiz_exam_publish_state();

alter table public.quiz_questions
  add column if not exists estimated_time_sec integer null check (estimated_time_sec is null or estimated_time_sec > 0);

alter table public.quiz_attempts
  add column if not exists duration_seconds integer not null default 0 check (duration_seconds >= 0),
  add column if not exists is_pass boolean not null default false;

create table if not exists public.quiz_attempt_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  selected_answer_index integer null,
  is_correct boolean not null,
  response_time_ms integer not null default 0 check (response_time_ms >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_attempt_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  event_type text not null check (event_type in ('start', 'question_view', 'question_answer', 'submit', 'abandon')),
  question_id uuid null references public.quiz_questions(id) on delete set null,
  event_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_quiz_attempt_responses_attempt on public.quiz_attempt_responses(attempt_id);
create index if not exists idx_quiz_attempt_responses_question on public.quiz_attempt_responses(question_id);
create index if not exists idx_quiz_attempt_events_attempt on public.quiz_attempt_events(attempt_id, event_at desc);
create index if not exists idx_quiz_attempt_events_type on public.quiz_attempt_events(event_type);
create index if not exists idx_quiz_attempts_exam_completed on public.quiz_attempts(exam_id, completed_at desc);

alter table public.quiz_attempt_responses enable row level security;
alter table public.quiz_attempt_events enable row level security;

drop policy if exists "quiz_exams_select_published_or_owner" on public.quiz_exams;
drop policy if exists "quiz_exams_insert_owner" on public.quiz_exams;
drop policy if exists "quiz_exams_update_owner" on public.quiz_exams;
drop policy if exists "quiz_exams_delete_owner" on public.quiz_exams;

create policy "quiz_exams_select_published_or_author_or_privileged"
on public.quiz_exams
for select
to authenticated
using (
  status = 'published'
  or is_published = true
  or created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
);

create policy "quiz_exams_insert_author_or_privileged"
on public.quiz_exams
for insert
to authenticated
with check (
  (
    created_by = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'training_officer'
    )
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator')
  )
);

create policy "quiz_exams_update_owner_or_privileged"
on public.quiz_exams
for update
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator')
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator')
  )
);

create policy "quiz_exams_delete_owner_or_privileged"
on public.quiz_exams
for delete
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator')
  )
);

drop policy if exists "quiz_questions_select_published_or_owner" on public.quiz_questions;
drop policy if exists "quiz_questions_insert_owner" on public.quiz_questions;
drop policy if exists "quiz_questions_update_owner" on public.quiz_questions;
drop policy if exists "quiz_questions_delete_owner" on public.quiz_questions;

create policy "quiz_questions_select_published_or_author_or_privileged"
on public.quiz_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.quiz_exams e
    where e.id = quiz_questions.exam_id
      and (
        e.status = 'published'
        or e.is_published = true
        or e.created_by = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'moderator', 'training_officer')
        )
      )
  )
);

create policy "quiz_questions_insert_author_or_privileged"
on public.quiz_questions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.quiz_exams e
    where e.id = quiz_questions.exam_id
      and (
        e.created_by = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'moderator')
        )
      )
  )
);

create policy "quiz_questions_update_author_or_privileged"
on public.quiz_questions
for update
to authenticated
using (
  exists (
    select 1
    from public.quiz_exams e
    where e.id = quiz_questions.exam_id
      and (
        e.created_by = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'moderator')
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.quiz_exams e
    where e.id = quiz_questions.exam_id
      and (
        e.created_by = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'moderator')
        )
      )
  )
);

create policy "quiz_questions_delete_author_or_privileged"
on public.quiz_questions
for delete
to authenticated
using (
  exists (
    select 1
    from public.quiz_exams e
    where e.id = quiz_questions.exam_id
      and (
        e.created_by = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'moderator')
        )
      )
  )
);

drop policy if exists "quiz_attempts_insert_own" on public.quiz_attempts;
drop policy if exists "quiz_attempts_select_own_or_exam_owner_or_privileged" on public.quiz_attempts;
drop policy if exists "quiz_attempts_select_own" on public.quiz_attempts;
drop policy if exists "quiz_attempts_select_exam_owner" on public.quiz_attempts;

create policy "quiz_attempts_select_own_or_author_or_privileged"
on public.quiz_attempts
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.quiz_exams e
    where e.id = quiz_attempts.exam_id
      and e.created_by = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
);

drop policy if exists "quiz_attempt_responses_select_own_or_privileged" on public.quiz_attempt_responses;
create policy "quiz_attempt_responses_select_own_or_privileged"
on public.quiz_attempt_responses
for select
to authenticated
using (
  exists (
    select 1
    from public.quiz_attempts a
    where a.id = quiz_attempt_responses.attempt_id
      and (
        a.user_id = auth.uid()
        or exists (
          select 1
          from public.quiz_exams e
          where e.id = a.exam_id
            and e.created_by = auth.uid()
        )
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'moderator', 'training_officer')
        )
      )
  )
);

drop policy if exists "quiz_attempt_events_select_own_or_privileged" on public.quiz_attempt_events;
create policy "quiz_attempt_events_select_own_or_privileged"
on public.quiz_attempt_events
for select
to authenticated
using (
  exists (
    select 1
    from public.quiz_attempts a
    where a.id = quiz_attempt_events.attempt_id
      and (
        a.user_id = auth.uid()
        or exists (
          select 1
          from public.quiz_exams e
          where e.id = a.exam_id
            and e.created_by = auth.uid()
        )
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'moderator', 'training_officer')
        )
      )
  )
);

create or replace function public.submit_quiz_attempt(
  p_exam_id uuid,
  p_answers jsonb,
  p_started_at timestamptz,
  p_client_events jsonb default '[]'::jsonb
)
returns table (
  attempt_id uuid,
  score integer,
  total_points integer,
  correct_count integer,
  is_pass boolean,
  duration_seconds integer,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := 'resident';
  v_exam public.quiz_exams%rowtype;
  v_q public.quiz_questions%rowtype;
  v_selected integer;
  v_response_ms integer;
  v_score integer := 0;
  v_total integer := 0;
  v_correct integer := 0;
  v_duration integer := 0;
  v_is_pass boolean := false;
  v_attempt_id uuid;
  v_completed_at timestamptz := now();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_uid;

  select *
  into v_exam
  from public.quiz_exams e
  where e.id = p_exam_id;

  if not found then
    raise exception 'Exam not found';
  end if;

  if not (
    v_exam.status = 'published'
    or v_exam.is_published = true
    or v_exam.created_by = v_uid
    or coalesce(v_role, 'resident') in ('admin', 'moderator', 'training_officer')
  ) then
    raise exception 'Exam is not available';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Answers payload must be an object';
  end if;

  for v_q in
    select *
    from public.quiz_questions q
    where q.exam_id = p_exam_id
    order by q.sort_order asc, q.created_at asc
  loop
    v_total := v_total + coalesce(v_q.points, 1);
    v_selected := null;
    v_response_ms := 0;

    begin
      v_selected := nullif((p_answers -> v_q.id::text ->> 'selected_answer_index')::integer, null);
    exception when others then
      v_selected := null;
    end;

    begin
      v_response_ms := greatest(0, coalesce((p_answers -> v_q.id::text ->> 'response_time_ms')::integer, 0));
    exception when others then
      v_response_ms := 0;
    end;

    if v_selected is not null and v_selected = v_q.correct_answer_index then
      v_correct := v_correct + 1;
      v_score := v_score + coalesce(v_q.points, 1);
    end if;
  end loop;

  v_duration := greatest(0, floor(extract(epoch from (v_completed_at - coalesce(p_started_at, v_completed_at))))::integer);
  if v_total > 0 then
    v_is_pass := ((v_score::numeric / v_total::numeric) * 100.0) >= v_exam.pass_mark_percent;
  end if;

  insert into public.quiz_attempts (
    exam_id,
    user_id,
    answers,
    score,
    total_points,
    correct_count,
    started_at,
    completed_at,
    duration_seconds,
    is_pass
  )
  values (
    p_exam_id,
    v_uid,
    p_answers,
    v_score,
    v_total,
    v_correct,
    coalesce(p_started_at, now()),
    v_completed_at,
    v_duration,
    v_is_pass
  )
  returning id into v_attempt_id;

  for v_q in
    select *
    from public.quiz_questions q
    where q.exam_id = p_exam_id
    order by q.sort_order asc, q.created_at asc
  loop
    v_selected := null;
    v_response_ms := 0;
    begin
      v_selected := nullif((p_answers -> v_q.id::text ->> 'selected_answer_index')::integer, null);
    exception when others then
      v_selected := null;
    end;
    begin
      v_response_ms := greatest(0, coalesce((p_answers -> v_q.id::text ->> 'response_time_ms')::integer, 0));
    exception when others then
      v_response_ms := 0;
    end;

    insert into public.quiz_attempt_responses (
      attempt_id,
      question_id,
      selected_answer_index,
      is_correct,
      response_time_ms
    ) values (
      v_attempt_id,
      v_q.id,
      v_selected,
      (v_selected is not null and v_selected = v_q.correct_answer_index),
      v_response_ms
    );
  end loop;

  if p_client_events is not null and jsonb_typeof(p_client_events) = 'array' then
    insert into public.quiz_attempt_events (attempt_id, event_type, question_id, event_at, meta)
    select
      v_attempt_id,
      coalesce(nullif((ev ->> 'event_type'), ''), 'question_view')::text,
      nullif((ev ->> 'question_id'), '')::uuid,
      coalesce((ev ->> 'event_at')::timestamptz, now()),
      coalesce(ev -> 'meta', '{}'::jsonb)
    from jsonb_array_elements(p_client_events) ev
    where coalesce(nullif((ev ->> 'event_type'), ''), 'question_view') in ('start', 'question_view', 'question_answer', 'submit', 'abandon');
  end if;

  insert into public.quiz_attempt_events (attempt_id, event_type, question_id, event_at, meta)
  values (v_attempt_id, 'submit', null, v_completed_at, jsonb_build_object('source', 'rpc'));

  return query
  select
    v_attempt_id,
    v_score,
    v_total,
    v_correct,
    v_is_pass,
    v_duration,
    v_completed_at;
end;
$$;

grant execute on function public.submit_quiz_attempt(uuid, jsonb, timestamptz, jsonb) to authenticated;

create or replace view public.quiz_exam_analytics_v as
with privileged as (
  select 1 as ok
  where exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
),
attempt_base as (
  select
    a.id,
    a.exam_id,
    a.user_id,
    a.score,
    a.total_points,
    a.correct_count,
    a.duration_seconds,
    a.is_pass,
    a.completed_at,
    date_trunc('day', a.completed_at) as day_bucket,
    date_trunc('week', a.completed_at) as week_bucket,
    date_trunc('month', a.completed_at) as month_bucket
  from public.quiz_attempts a
),
starts as (
  select e.attempt_id
  from public.quiz_attempt_events e
  where e.event_type = 'start'
)
select
  ab.exam_id,
  ex.title as exam_title,
  ex.specialty,
  ab.day_bucket,
  ab.week_bucket,
  ab.month_bucket,
  count(*)::bigint as attempts_count,
  count(distinct ab.user_id)::bigint as unique_takers,
  round(avg(case when ab.total_points > 0 then (ab.score::numeric / ab.total_points::numeric) * 100 else 0 end), 2) as avg_score_percent,
  percentile_cont(0.5) within group (order by (case when ab.total_points > 0 then (ab.score::numeric / ab.total_points::numeric) * 100 else 0 end)) as median_score_percent,
  round(avg(case when ab.is_pass then 1 else 0 end)::numeric * 100, 2) as pass_rate_percent,
  round(avg(ab.duration_seconds)::numeric, 2) as avg_duration_seconds,
  case
    when count(s.attempt_id) = 0 then 100
    else round((count(*)::numeric / count(s.attempt_id)::numeric) * 100, 2)
  end as completion_rate_percent
from attempt_base ab
join privileged pv on true
join public.quiz_exams ex on ex.id = ab.exam_id
left join starts s on s.attempt_id = ab.id
group by ab.exam_id, ex.title, ex.specialty, ab.day_bucket, ab.week_bucket, ab.month_bucket;

create or replace view public.quiz_question_analytics_v as
with privileged as (
  select 1 as ok
  where exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
),
attempt_scores as (
  select
    a.id as attempt_id,
    a.exam_id,
    case when a.total_points > 0 then a.score::numeric / a.total_points::numeric else 0 end as pct
  from public.quiz_attempts a
),
ranked_attempts as (
  select
    attempt_id,
    exam_id,
    pct,
    ntile(4) over (partition by exam_id order by pct) as quartile
  from attempt_scores
)
select
  q.exam_id,
  ex.title as exam_title,
  ex.specialty,
  q.id as question_id,
  q.question_text,
  q.sort_order,
  count(r.id)::bigint as responses_count,
  round(avg(case when r.is_correct then 1 else 0 end)::numeric * 100, 2) as correct_rate_percent,
  round(avg(r.response_time_ms)::numeric, 2) as avg_response_time_ms,
  round(
    coalesce(avg(case when ra.quartile in (3, 4) then case when r.is_correct then 1 else 0 end end), 0)
    -
    coalesce(avg(case when ra.quartile in (1, 2) then case when r.is_correct then 1 else 0 end end), 0),
    4
  ) as discrimination_proxy
from public.quiz_questions q
join privileged pv on true
join public.quiz_exams ex on ex.id = q.exam_id
left join public.quiz_attempt_responses r on r.question_id = q.id
left join ranked_attempts ra on ra.attempt_id = r.attempt_id
group by q.exam_id, ex.title, ex.specialty, q.id, q.question_text, q.sort_order;

create or replace view public.quiz_user_analytics_v as
with privileged as (
  select 1 as ok
  where exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
)
select
  a.user_id,
  pr.full_name,
  pr.username,
  pr.role,
  pr.year_level,
  count(*)::bigint as attempts_count,
  count(distinct a.exam_id)::bigint as unique_exams,
  round(avg(case when a.total_points > 0 then (a.score::numeric / a.total_points::numeric) * 100 else 0 end), 2) as avg_score_percent,
  round(avg(case when a.is_pass then 1 else 0 end)::numeric * 100, 2) as pass_rate_percent,
  round(avg(a.duration_seconds)::numeric, 2) as avg_duration_seconds,
  max(a.completed_at) as last_attempt_at
from public.quiz_attempts a
join privileged pv on true
left join public.profiles pr on pr.id = a.user_id
group by a.user_id, pr.full_name, pr.username, pr.role, pr.year_level;

create or replace view public.quiz_group_analytics_v as
with privileged as (
  select 1 as ok
  where exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
)
select
  coalesce(pr.role, 'resident') as role,
  coalesce(nullif(pr.year_level, ''), 'N/A') as year_level,
  count(*)::bigint as attempts_count,
  count(distinct a.user_id)::bigint as learners_count,
  round(avg(case when a.total_points > 0 then (a.score::numeric / a.total_points::numeric) * 100 else 0 end), 2) as avg_score_percent,
  round(avg(case when a.is_pass then 1 else 0 end)::numeric * 100, 2) as pass_rate_percent,
  round(avg(a.duration_seconds)::numeric, 2) as avg_duration_seconds
from public.quiz_attempts a
join privileged pv on true
left join public.profiles pr on pr.id = a.user_id
group by coalesce(pr.role, 'resident'), coalesce(nullif(pr.year_level, ''), 'N/A');
