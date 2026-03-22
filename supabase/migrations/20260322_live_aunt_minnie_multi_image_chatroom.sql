create table if not exists public.live_aunt_minnie_prompt_images (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.live_aunt_minnie_prompts(id) on delete cascade,
  session_id uuid not null references public.live_aunt_minnie_sessions(id) on delete cascade,
  sort_order integer not null default 0,
  image_url text not null,
  caption text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.live_aunt_minnie_prompt_images enable row level security;

create or replace function public.set_live_aunt_minnie_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists live_aunt_minnie_prompt_images_set_updated_at on public.live_aunt_minnie_prompt_images;
create trigger live_aunt_minnie_prompt_images_set_updated_at
before update on public.live_aunt_minnie_prompt_images
for each row
execute function public.set_live_aunt_minnie_updated_at();

alter table public.live_aunt_minnie_responses
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

drop trigger if exists live_aunt_minnie_responses_set_updated_at on public.live_aunt_minnie_responses;
create trigger live_aunt_minnie_responses_set_updated_at
before update on public.live_aunt_minnie_responses
for each row
execute function public.set_live_aunt_minnie_updated_at();

create unique index if not exists live_aunt_minnie_responses_session_prompt_user_idx
  on public.live_aunt_minnie_responses(session_id, prompt_id, user_id);

create index if not exists live_aunt_minnie_prompts_session_sort_idx
  on public.live_aunt_minnie_prompts(session_id, sort_order);

create index if not exists live_aunt_minnie_prompt_images_prompt_sort_idx
  on public.live_aunt_minnie_prompt_images(prompt_id, sort_order);

create index if not exists live_aunt_minnie_responses_session_prompt_idx
  on public.live_aunt_minnie_responses(session_id, prompt_id);

insert into public.live_aunt_minnie_prompt_images (prompt_id, session_id, sort_order, image_url, caption)
select p.id, p.session_id, 0, p.image_url, p.image_caption
from public.live_aunt_minnie_prompts p
where coalesce(p.image_url, '') <> ''
  and not exists (
    select 1
    from public.live_aunt_minnie_prompt_images i
    where i.prompt_id = p.id
  );

drop policy if exists "live_aunt_minnie_prompt_images_select" on public.live_aunt_minnie_prompt_images;
create policy "live_aunt_minnie_prompt_images_select"
on public.live_aunt_minnie_prompt_images
for select
to authenticated
using (
  public.live_aunt_minnie_can_access_session(session_id)
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
  )
)
with check (
  exists (
    select 1
    from public.live_aunt_minnie_sessions s
    where s.id = live_aunt_minnie_prompt_images.session_id
      and s.host_user_id = auth.uid()
  )
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
      and s.status not in ('completed', 'cancelled')
      and public.live_aunt_minnie_can_access_session(s.id)
  )
);

drop policy if exists "live_aunt_minnie_responses_update" on public.live_aunt_minnie_responses;
create policy "live_aunt_minnie_responses_update"
on public.live_aunt_minnie_responses
for update
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.live_aunt_minnie_sessions s
    where s.id = live_aunt_minnie_responses.session_id
      and s.status not in ('completed', 'cancelled')
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.live_aunt_minnie_sessions s
    where s.id = live_aunt_minnie_responses.session_id
      and s.status not in ('completed', 'cancelled')
  )
);
