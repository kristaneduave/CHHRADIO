alter table public.live_aunt_minnie_sessions
  add column if not exists auto_advance_interval_seconds integer,
  add column if not exists next_prompt_at timestamptz;
