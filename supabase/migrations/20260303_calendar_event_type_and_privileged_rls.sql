-- Ensure calendar supports PCR events and privileged management parity with UI.

alter table public.events
drop constraint if exists events_event_type_check;

alter table public.events
add constraint events_event_type_check
check (
  event_type = any (
    array['rotation', 'call', 'lecture', 'exam', 'leave', 'meeting', 'other', 'pickleball', 'pcr']
  )
);

drop policy if exists "events_update_by_creator_or_privileged" on public.events;
create policy "events_update_by_creator_or_privileged"
on public.events
for update
to authenticated
using (
  auth.uid() = created_by
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
)
with check (
  auth.uid() = created_by
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
);

drop policy if exists "events_delete_by_creator_or_privileged" on public.events;
create policy "events_delete_by_creator_or_privileged"
on public.events
for delete
to authenticated
using (
  auth.uid() = created_by
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator', 'training_officer')
  )
);
