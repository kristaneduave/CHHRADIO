create table if not exists public.live_aunt_minnie_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_aunt_minnie_sessions(id) on delete cascade,
  prompt_id uuid not null references public.live_aunt_minnie_prompts(id) on delete cascade,
  user_id uuid not null,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint live_aunt_minnie_messages_body_check check (char_length(btrim(body)) > 0)
);

alter table public.live_aunt_minnie_messages enable row level security;

drop trigger if exists live_aunt_minnie_messages_set_updated_at on public.live_aunt_minnie_messages;
create trigger live_aunt_minnie_messages_set_updated_at
before update on public.live_aunt_minnie_messages
for each row
execute function public.set_live_aunt_minnie_updated_at();

create index if not exists live_aunt_minnie_messages_session_prompt_created_idx
  on public.live_aunt_minnie_messages(session_id, prompt_id, created_at);

create index if not exists live_aunt_minnie_messages_session_user_idx
  on public.live_aunt_minnie_messages(session_id, user_id);

insert into public.live_aunt_minnie_messages (id, session_id, prompt_id, user_id, body, created_at, updated_at)
select
  r.id,
  r.session_id,
  r.prompt_id,
  r.user_id,
  r.response_text,
  r.submitted_at,
  coalesce(r.updated_at, r.submitted_at)
from public.live_aunt_minnie_responses r
where coalesce(btrim(r.response_text), '') <> ''
  and not exists (
    select 1
    from public.live_aunt_minnie_messages m
    where m.id = r.id
  );

drop policy if exists "live_aunt_minnie_messages_select" on public.live_aunt_minnie_messages;
create policy "live_aunt_minnie_messages_select"
on public.live_aunt_minnie_messages
for select
to authenticated
using (
  public.live_aunt_minnie_can_access_session(session_id)
);

drop policy if exists "live_aunt_minnie_messages_insert" on public.live_aunt_minnie_messages;
create policy "live_aunt_minnie_messages_insert"
on public.live_aunt_minnie_messages
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.live_aunt_minnie_sessions s
    where s.id = live_aunt_minnie_messages.session_id
      and s.status not in ('completed', 'cancelled')
      and public.live_aunt_minnie_can_access_session(s.id)
  )
);

drop policy if exists "live_aunt_minnie_messages_update" on public.live_aunt_minnie_messages;
create policy "live_aunt_minnie_messages_update"
on public.live_aunt_minnie_messages
for update
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.live_aunt_minnie_sessions s
    where s.id = live_aunt_minnie_messages.session_id
      and s.status not in ('completed', 'cancelled')
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.live_aunt_minnie_sessions s
    where s.id = live_aunt_minnie_messages.session_id
      and s.status not in ('completed', 'cancelled')
  )
);

drop policy if exists "live_aunt_minnie_messages_delete" on public.live_aunt_minnie_messages;
create policy "live_aunt_minnie_messages_delete"
on public.live_aunt_minnie_messages
for delete
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.live_aunt_minnie_sessions s
    where s.id = live_aunt_minnie_messages.session_id
      and s.status not in ('completed', 'cancelled')
  )
);
