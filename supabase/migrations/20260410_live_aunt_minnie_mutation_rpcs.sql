create or replace function public.submit_live_aunt_minnie_response(
  p_session_id uuid,
  p_prompt_id uuid,
  p_response_text text
)
returns setof public.live_aunt_minnie_responses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.live_aunt_minnie_sessions%rowtype;
  v_trimmed_response text := btrim(coalesce(p_response_text, ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_trimmed_response = '' then
    raise exception 'Answer cannot be empty.';
  end if;

  select *
  into v_session
  from public.live_aunt_minnie_sessions
  where id = p_session_id;

  if not found then
    raise exception 'Live Aunt Minnie session not found.';
  end if;

  if v_session.host_user_id = auth.uid() then
    raise exception 'Hosts cannot submit answers in their own Live Aunt Minnie room.';
  end if;

  if v_session.status in ('completed', 'cancelled') or v_session.status <> 'live' or v_session.current_phase <> 'prompt_open' then
    raise exception 'Answers are locked for this exam.';
  end if;

  return query
  insert into public.live_aunt_minnie_responses (
    session_id,
    prompt_id,
    user_id,
    response_text,
    judgment,
    updated_at
  )
  values (
    p_session_id,
    p_prompt_id,
    auth.uid(),
    v_trimmed_response,
    'unreviewed',
    timezone('utc', now())
  )
  on conflict (session_id, prompt_id, user_id)
  do update
    set response_text = excluded.response_text,
        judgment = 'unreviewed',
        updated_at = timezone('utc', now())
  returning *;
end;
$$;

grant execute on function public.submit_live_aunt_minnie_response(uuid, uuid, text) to authenticated;

create or replace function public.delete_live_aunt_minnie_response(
  p_session_id uuid,
  p_prompt_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.live_aunt_minnie_sessions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_session
  from public.live_aunt_minnie_sessions
  where id = p_session_id;

  if not found then
    raise exception 'Live Aunt Minnie session not found.';
  end if;

  if v_session.host_user_id = auth.uid() then
    raise exception 'Hosts cannot delete answers in their own Live Aunt Minnie room.';
  end if;

  if v_session.status in ('completed', 'cancelled') or v_session.status <> 'live' or v_session.current_phase <> 'prompt_open' then
    raise exception 'Answers are locked for this exam.';
  end if;

  delete from public.live_aunt_minnie_responses
  where session_id = p_session_id
    and prompt_id = p_prompt_id
    and user_id = auth.uid();
end;
$$;

grant execute on function public.delete_live_aunt_minnie_response(uuid, uuid) to authenticated;

create or replace function public.delete_live_aunt_minnie_session(
  p_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.live_aunt_minnie_sessions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_session
  from public.live_aunt_minnie_sessions
  where id = p_session_id;

  if not found then
    raise exception 'Live Aunt Minnie session not found.';
  end if;

  if v_session.host_user_id <> auth.uid() then
    raise exception 'Only the host can delete this room.';
  end if;

  delete from public.live_aunt_minnie_prompt_images
  where session_id = p_session_id;

  delete from public.live_aunt_minnie_responses
  where session_id = p_session_id;

  delete from public.live_aunt_minnie_messages
  where session_id = p_session_id;

  delete from public.live_aunt_minnie_participants
  where session_id = p_session_id;

  delete from public.live_aunt_minnie_prompts
  where session_id = p_session_id;

  delete from public.live_aunt_minnie_sessions
  where id = p_session_id
    and host_user_id = auth.uid();
end;
$$;

grant execute on function public.delete_live_aunt_minnie_session(uuid) to authenticated;
