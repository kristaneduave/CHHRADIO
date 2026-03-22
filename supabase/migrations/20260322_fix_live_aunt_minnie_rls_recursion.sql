create or replace function public.live_aunt_minnie_can_access_session(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.live_aunt_minnie_sessions s
    where s.id = target_session_id
      and (
        s.host_user_id = auth.uid()
        or exists (
          select 1
          from public.live_aunt_minnie_participants p
          where p.session_id = s.id
            and p.user_id = auth.uid()
        )
        or (
          s.status in ('live', 'paused')
          and s.allow_late_join
        )
      )
  );
$$;

drop policy if exists "live_aunt_minnie_sessions_select" on public.live_aunt_minnie_sessions;
create policy "live_aunt_minnie_sessions_select"
on public.live_aunt_minnie_sessions
for select
to authenticated
using (
  public.live_aunt_minnie_can_access_session(id)
);

drop policy if exists "live_aunt_minnie_participants_select" on public.live_aunt_minnie_participants;
create policy "live_aunt_minnie_participants_select"
on public.live_aunt_minnie_participants
for select
to authenticated
using (
  auth.uid() = user_id
  or public.live_aunt_minnie_can_access_session(session_id)
);

drop policy if exists "live_aunt_minnie_prompts_select" on public.live_aunt_minnie_prompts;
create policy "live_aunt_minnie_prompts_select"
on public.live_aunt_minnie_prompts
for select
to authenticated
using (
  public.live_aunt_minnie_can_access_session(session_id)
);

drop policy if exists "live_aunt_minnie_responses_insert" on public.live_aunt_minnie_responses;
create policy "live_aunt_minnie_responses_insert"
on public.live_aunt_minnie_responses
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.live_aunt_minnie_sessions s
    where s.id = live_aunt_minnie_responses.session_id
      and s.status = 'live'
      and s.current_phase = 'prompt_open'
      and public.live_aunt_minnie_can_access_session(s.id)
  )
);
