create unique index if not exists live_aunt_minnie_sessions_join_code_idx
  on public.live_aunt_minnie_sessions(join_code)
  where join_code is not null;

create index if not exists live_aunt_minnie_sessions_host_updated_idx
  on public.live_aunt_minnie_sessions(host_user_id, updated_at desc);

create index if not exists live_aunt_minnie_sessions_status_updated_idx
  on public.live_aunt_minnie_sessions(status, updated_at desc);
