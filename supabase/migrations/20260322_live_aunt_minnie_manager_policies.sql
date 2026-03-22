create or replace function public.current_user_is_live_aunt_minnie_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'training_officer')
  );
$$;

drop policy if exists "live_aunt_minnie_sessions_insert" on public.live_aunt_minnie_sessions;
create policy "live_aunt_minnie_sessions_insert"
on public.live_aunt_minnie_sessions
for insert
to authenticated
with check (
  auth.uid() = host_user_id
  and auth.uid() = created_by
  and public.current_user_is_live_aunt_minnie_manager()
);

drop policy if exists "live_aunt_minnie_sessions_update" on public.live_aunt_minnie_sessions;
create policy "live_aunt_minnie_sessions_update"
on public.live_aunt_minnie_sessions
for update
to authenticated
using (
  auth.uid() = host_user_id
  and public.current_user_is_live_aunt_minnie_manager()
)
with check (
  auth.uid() = host_user_id
  and public.current_user_is_live_aunt_minnie_manager()
);

drop policy if exists "live_aunt_minnie_sessions_delete" on public.live_aunt_minnie_sessions;
create policy "live_aunt_minnie_sessions_delete"
on public.live_aunt_minnie_sessions
for delete
to authenticated
using (
  auth.uid() = host_user_id
  and public.current_user_is_live_aunt_minnie_manager()
);

drop policy if exists "live_aunt_minnie_participants_insert" on public.live_aunt_minnie_participants;
create policy "live_aunt_minnie_participants_insert"
on public.live_aunt_minnie_participants
for insert
to authenticated
with check (
  (
    auth.uid() = user_id
    and public.live_aunt_minnie_can_access_session(session_id)
  )
  or exists (
    select 1
    from public.live_aunt_minnie_sessions s
    where s.id = live_aunt_minnie_participants.session_id
      and s.host_user_id = auth.uid()
      and public.current_user_is_live_aunt_minnie_manager()
  )
);

drop policy if exists "live_aunt_minnie_participants_update" on public.live_aunt_minnie_participants;
create policy "live_aunt_minnie_participants_update"
on public.live_aunt_minnie_participants
for update
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.live_aunt_minnie_sessions s
    where s.id = live_aunt_minnie_participants.session_id
      and s.host_user_id = auth.uid()
      and public.current_user_is_live_aunt_minnie_manager()
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.live_aunt_minnie_sessions s
    where s.id = live_aunt_minnie_participants.session_id
      and s.host_user_id = auth.uid()
      and public.current_user_is_live_aunt_minnie_manager()
  )
);

drop policy if exists "live_aunt_minnie_prompts_manage" on public.live_aunt_minnie_prompts;
create policy "live_aunt_minnie_prompts_manage"
on public.live_aunt_minnie_prompts
for all
to authenticated
using (
  exists (
    select 1
    from public.live_aunt_minnie_sessions s
    where s.id = live_aunt_minnie_prompts.session_id
      and s.host_user_id = auth.uid()
      and public.current_user_is_live_aunt_minnie_manager()
  )
)
with check (
  exists (
    select 1
    from public.live_aunt_minnie_sessions s
    where s.id = live_aunt_minnie_prompts.session_id
      and s.host_user_id = auth.uid()
      and public.current_user_is_live_aunt_minnie_manager()
  )
);

drop policy if exists "live_aunt_minnie_prompt_images_manage" on public.live_aunt_minnie_prompt_images;
create policy "live_aunt_minnie_prompt_images_manage"
on public.live_aunt_minnie_prompt_images
for all
to authenticated
using (
  exists (
    select 1
    from public.live_aunt_minnie_sessions s
    where s.id = live_aunt_minnie_prompt_images.session_id
      and s.host_user_id = auth.uid()
      and public.current_user_is_live_aunt_minnie_manager()
  )
)
with check (
  exists (
    select 1
    from public.live_aunt_minnie_sessions s
    where s.id = live_aunt_minnie_prompt_images.session_id
      and s.host_user_id = auth.uid()
      and public.current_user_is_live_aunt_minnie_manager()
  )
);
