create extension if not exists pgcrypto;

create table if not exists public.needle_scenarios (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  anatomy text not null,
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  time_limit_sec integer not null check (time_limit_sec between 60 and 600),
  field_width integer not null default 1000,
  field_height integer not null default 560,
  needle_entry_x numeric not null,
  needle_entry_y numeric not null,
  max_depth numeric not null check (max_depth > 0),
  target_config jsonb not null,
  risk_config jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.needle_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references public.needle_scenarios(id) on delete restrict,
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  duration_ms integer not null check (duration_ms >= 0),
  score integer not null check (score between 0 and 100),
  competency_band text not null check (competency_band in ('Excellent', 'Safe', 'Needs Practice')),
  metrics jsonb not null default '{}'::jsonb,
  breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.needle_session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.needle_sessions(id) on delete cascade,
  event_type text not null,
  event_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_needle_sessions_user_completed on public.needle_sessions(user_id, completed_at desc);
create index if not exists idx_needle_sessions_scenario_completed on public.needle_sessions(scenario_id, completed_at desc);
create index if not exists idx_needle_session_events_session on public.needle_session_events(session_id, event_at desc);

alter table public.needle_scenarios enable row level security;
alter table public.needle_sessions enable row level security;
alter table public.needle_session_events enable row level security;

drop policy if exists "needle_scenarios_select_active_authenticated" on public.needle_scenarios;
create policy "needle_scenarios_select_active_authenticated"
on public.needle_scenarios
for select
to authenticated
using (is_active = true);

drop policy if exists "needle_sessions_select_own_or_privileged" on public.needle_sessions;
create policy "needle_sessions_select_own_or_privileged"
on public.needle_sessions
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
);

drop policy if exists "needle_sessions_insert_own" on public.needle_sessions;
create policy "needle_sessions_insert_own"
on public.needle_sessions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "needle_session_events_select_own_or_privileged" on public.needle_session_events;
create policy "needle_session_events_select_own_or_privileged"
on public.needle_session_events
for select
to authenticated
using (
  exists (
    select 1 from public.needle_sessions s
    where s.id = needle_session_events.session_id
      and (
        s.user_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'moderator', 'training_officer')
        )
      )
  )
);

drop policy if exists "needle_session_events_insert_own" on public.needle_session_events;
create policy "needle_session_events_insert_own"
on public.needle_session_events
for insert
to authenticated
with check (
  exists (
    select 1 from public.needle_sessions s
    where s.id = needle_session_events.session_id
      and s.user_id = auth.uid()
  )
);

create or replace function public.submit_needle_session(
  p_scenario_id uuid,
  p_started_at timestamptz,
  p_duration_ms integer,
  p_score integer,
  p_competency_band text,
  p_metrics jsonb,
  p_breakdown jsonb,
  p_events jsonb
)
returns table (
  id uuid,
  user_id uuid,
  scenario_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  score integer,
  competency_band text,
  metrics jsonb,
  breakdown jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_event jsonb;
begin
  insert into public.needle_sessions (
    user_id,
    scenario_id,
    started_at,
    completed_at,
    duration_ms,
    score,
    competency_band,
    metrics,
    breakdown
  )
  values (
    auth.uid(),
    p_scenario_id,
    p_started_at,
    now(),
    greatest(0, p_duration_ms),
    greatest(0, least(100, p_score)),
    case when p_competency_band in ('Excellent', 'Safe', 'Needs Practice') then p_competency_band else 'Needs Practice' end,
    coalesce(p_metrics, '{}'::jsonb),
    coalesce(p_breakdown, '{}'::jsonb)
  )
  returning needle_sessions.id into v_session_id;

  if jsonb_typeof(p_events) = 'array' then
    for v_event in select value from jsonb_array_elements(p_events)
    loop
      insert into public.needle_session_events (session_id, event_type, event_at, meta)
      values (
        v_session_id,
        coalesce(v_event->>'event_type', 'unknown'),
        coalesce((v_event->>'event_at')::timestamptz, now()),
        coalesce(v_event->'meta', '{}'::jsonb)
      );
    end loop;
  end if;

  return query
  select
    s.id,
    s.user_id,
    s.scenario_id,
    s.started_at,
    s.completed_at,
    s.duration_ms,
    s.score,
    s.competency_band,
    s.metrics,
    s.breakdown
  from public.needle_sessions s
  where s.id = v_session_id;
end;
$$;

revoke all on function public.submit_needle_session(
  uuid,
  timestamptz,
  integer,
  integer,
  text,
  jsonb,
  jsonb,
  jsonb
) from public;
grant execute on function public.submit_needle_session(
  uuid,
  timestamptz,
  integer,
  integer,
  text,
  jsonb,
  jsonb,
  jsonb
) to authenticated;

create or replace view public.needle_user_stats_v as
select
  s.user_id,
  count(*)::int as runs_count,
  round(avg(s.score)::numeric, 2) as avg_score,
  max(s.score)::int as best_score,
  count(*) filter (where s.competency_band = 'Excellent')::int as excellent_count
from public.needle_sessions s
group by s.user_id;

create or replace view public.needle_leaderboard_7d_v as
select
  s.user_id,
  coalesce(p.nickname, p.full_name, p.username, 'User') as display_name,
  p.avatar_url,
  p.role,
  count(*)::int as runs_count,
  round(avg(s.score)::numeric, 2) as avg_score,
  max(s.score)::int as best_score
from public.needle_sessions s
left join public.profiles p on p.id = s.user_id
where s.completed_at >= now() - interval '7 days'
group by s.user_id, p.nickname, p.full_name, p.username, p.avatar_url, p.role
order by avg_score desc, best_score desc, runs_count desc;

create or replace view public.needle_leaderboard_30d_v as
select
  s.user_id,
  coalesce(p.nickname, p.full_name, p.username, 'User') as display_name,
  p.avatar_url,
  p.role,
  count(*)::int as runs_count,
  round(avg(s.score)::numeric, 2) as avg_score,
  max(s.score)::int as best_score
from public.needle_sessions s
left join public.profiles p on p.id = s.user_id
where s.completed_at >= now() - interval '30 days'
group by s.user_id, p.nickname, p.full_name, p.username, p.avatar_url, p.role
order by avg_score desc, best_score desc, runs_count desc;

grant select on public.needle_user_stats_v to authenticated;
grant select on public.needle_leaderboard_7d_v to authenticated;
grant select on public.needle_leaderboard_30d_v to authenticated;

insert into public.needle_scenarios (
  id, title, anatomy, difficulty, time_limit_sec, field_width, field_height, needle_entry_x, needle_entry_y, max_depth, target_config, risk_config, is_active
)
values
(
  '9a0a1cde-5036-4ac0-a6f2-0f524d5c0011',
  'Liver Lesion Targeting',
  'Liver',
  'beginner',
  180,
  1000,
  560,
  120,
  300,
  760,
  '{"x":700,"baseY":290,"radiusX":52,"radiusY":36,"amplitude":18,"frequencyHz":0.16,"jitter":2}'::jsonb,
  '{"nearMissDistance":14,"zones":[{"id":"hepatic-artery","label":"Hepatic artery","x":620,"y":250,"radius":26},{"id":"portal-vein","label":"Portal vein","x":645,"y":338,"radius":30}]}'::jsonb,
  true
),
(
  '9a0a1cde-5036-4ac0-a6f2-0f524d5c0012',
  'Renal Cyst Aspiration',
  'Kidney',
  'intermediate',
  210,
  1000,
  560,
  120,
  300,
  780,
  '{"x":730,"baseY":308,"radiusX":42,"radiusY":30,"amplitude":24,"frequencyHz":0.22,"jitter":4}'::jsonb,
  '{"nearMissDistance":12,"zones":[{"id":"renal-artery","label":"Renal artery","x":660,"y":286,"radius":23},{"id":"colon","label":"Adjacent bowel","x":775,"y":346,"radius":28}]}'::jsonb,
  true
),
(
  '9a0a1cde-5036-4ac0-a6f2-0f524d5c0013',
  'Lung Nodule Biopsy',
  'Lung',
  'advanced',
  240,
  1000,
  560,
  120,
  300,
  820,
  '{"x":770,"baseY":270,"radiusX":32,"radiusY":24,"amplitude":30,"frequencyHz":0.28,"jitter":6}'::jsonb,
  '{"nearMissDistance":10,"zones":[{"id":"intercostal-vessel","label":"Intercostal vessel","x":696,"y":236,"radius":20},{"id":"major-vessel","label":"Major vessel","x":736,"y":334,"radius":24},{"id":"pleural-margin","label":"Pleural risk","x":816,"y":272,"radius":22}]}'::jsonb,
  true
)
on conflict (id) do update
set
  title = excluded.title,
  anatomy = excluded.anatomy,
  difficulty = excluded.difficulty,
  time_limit_sec = excluded.time_limit_sec,
  field_width = excluded.field_width,
  field_height = excluded.field_height,
  needle_entry_x = excluded.needle_entry_x,
  needle_entry_y = excluded.needle_entry_y,
  max_depth = excluded.max_depth,
  target_config = excluded.target_config,
  risk_config = excluded.risk_config,
  is_active = excluded.is_active;
