alter table public.live_aunt_minnie_sessions
  add column if not exists prompts_version bigint not null default 0,
  add column if not exists responses_version bigint not null default 0,
  add column if not exists messages_version bigint not null default 0,
  add column if not exists participants_version bigint not null default 0;

create or replace function public.bump_live_aunt_minnie_session_version(
  p_session_id uuid,
  p_column_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session_id is null then
    return;
  end if;

  execute format(
    'update public.live_aunt_minnie_sessions
     set %I = coalesce(%I, 0) + 1,
         updated_at = timezone(''utc'', now())
     where id = $1',
    p_column_name,
    p_column_name
  )
  using p_session_id;
end;
$$;

create or replace function public.handle_live_aunt_minnie_prompt_version_bump()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bump_live_aunt_minnie_session_version(
    coalesce(new.session_id, old.session_id),
    'prompts_version'
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.handle_live_aunt_minnie_response_version_bump()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bump_live_aunt_minnie_session_version(
    coalesce(new.session_id, old.session_id),
    'responses_version'
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.handle_live_aunt_minnie_message_version_bump()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bump_live_aunt_minnie_session_version(
    coalesce(new.session_id, old.session_id),
    'messages_version'
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.handle_live_aunt_minnie_participant_version_bump()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bump_live_aunt_minnie_session_version(
    coalesce(new.session_id, old.session_id),
    'participants_version'
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists live_aunt_minnie_prompts_bump_version on public.live_aunt_minnie_prompts;
create trigger live_aunt_minnie_prompts_bump_version
after insert or update or delete on public.live_aunt_minnie_prompts
for each row
execute function public.handle_live_aunt_minnie_prompt_version_bump();

drop trigger if exists live_aunt_minnie_prompt_images_bump_version on public.live_aunt_minnie_prompt_images;
create trigger live_aunt_minnie_prompt_images_bump_version
after insert or update or delete on public.live_aunt_minnie_prompt_images
for each row
execute function public.handle_live_aunt_minnie_prompt_version_bump();

drop trigger if exists live_aunt_minnie_responses_bump_version on public.live_aunt_minnie_responses;
create trigger live_aunt_minnie_responses_bump_version
after insert or update or delete on public.live_aunt_minnie_responses
for each row
execute function public.handle_live_aunt_minnie_response_version_bump();

drop trigger if exists live_aunt_minnie_messages_bump_version on public.live_aunt_minnie_messages;
create trigger live_aunt_minnie_messages_bump_version
after insert or update or delete on public.live_aunt_minnie_messages
for each row
execute function public.handle_live_aunt_minnie_message_version_bump();

drop trigger if exists live_aunt_minnie_participants_bump_version on public.live_aunt_minnie_participants;
create trigger live_aunt_minnie_participants_bump_version
after insert or update or delete on public.live_aunt_minnie_participants
for each row
execute function public.handle_live_aunt_minnie_participant_version_bump();
