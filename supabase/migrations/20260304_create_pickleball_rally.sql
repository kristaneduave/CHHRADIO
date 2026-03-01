create extension if not exists pgcrypto;

create table if not exists public.pickleball_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  score integer not null check (score >= 0),
  metrics jsonb not null default '{}'::jsonb,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pickleball_runs_user_created on public.pickleball_runs(user_id, created_at desc);
create index if not exists idx_pickleball_runs_score on public.pickleball_runs(score desc);
create index if not exists idx_pickleball_runs_created on public.pickleball_runs(created_at desc);

alter table public.pickleball_runs enable row level security;

drop policy if exists "pickleball_runs_select_own_or_privileged" on public.pickleball_runs;
create policy "pickleball_runs_select_own_or_privileged"
on public.pickleball_runs
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

drop policy if exists "pickleball_runs_insert_own" on public.pickleball_runs;
create policy "pickleball_runs_insert_own"
on public.pickleball_runs
for insert
to authenticated
with check (user_id = auth.uid());

create or replace view public.pickleball_leaderboard_7d_v as
select
  r.user_id,
  coalesce(p.nickname, p.full_name, p.username, 'User') as display_name,
  p.avatar_url,
  p.role,
  count(*)::int as runs_count,
  round(avg(r.score)::numeric, 2) as avg_score,
  max(r.score)::int as best_score
from public.pickleball_runs r
left join public.profiles p on p.id = r.user_id
where r.completed_at >= now() - interval '7 days'
group by r.user_id, p.nickname, p.full_name, p.username, p.avatar_url, p.role
order by avg_score desc, best_score desc, runs_count desc;

create or replace view public.pickleball_leaderboard_30d_v as
select
  r.user_id,
  coalesce(p.nickname, p.full_name, p.username, 'User') as display_name,
  p.avatar_url,
  p.role,
  count(*)::int as runs_count,
  round(avg(r.score)::numeric, 2) as avg_score,
  max(r.score)::int as best_score
from public.pickleball_runs r
left join public.profiles p on p.id = r.user_id
where r.completed_at >= now() - interval '30 days'
group by r.user_id, p.nickname, p.full_name, p.username, p.avatar_url, p.role
order by avg_score desc, best_score desc, runs_count desc;

create or replace view public.pickleball_user_stats_v as
with top_threshold as (
  select coalesce(percentile_disc(0.9) within group (order by score), 0)::int as p90
  from public.pickleball_runs
)
select
  r.user_id,
  count(*)::int as runs_count,
  round(avg(r.score)::numeric, 2) as avg_score,
  max(r.score)::int as best_score,
  count(*) filter (where r.score >= t.p90)::int as top10_count
from public.pickleball_runs r
cross join top_threshold t
group by r.user_id, t.p90;

grant select on public.pickleball_leaderboard_7d_v to authenticated;
grant select on public.pickleball_leaderboard_30d_v to authenticated;
grant select on public.pickleball_user_stats_v to authenticated;
