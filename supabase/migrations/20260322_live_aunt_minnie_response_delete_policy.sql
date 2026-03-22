drop policy if exists "live_aunt_minnie_responses_delete" on public.live_aunt_minnie_responses;
create policy "live_aunt_minnie_responses_delete"
on public.live_aunt_minnie_responses
for delete
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.live_aunt_minnie_sessions s
    where s.id = live_aunt_minnie_responses.session_id
      and s.status not in ('completed', 'cancelled')
  )
);
