create or replace function public.submit_live_aunt_minnie_message(
  p_session_id uuid,
  p_prompt_id uuid,
  p_body text
)
returns setof public.live_aunt_minnie_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.live_aunt_minnie_sessions%rowtype;
  v_trimmed_body text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_trimmed_body = '' then
    raise exception 'Message cannot be empty.';
  end if;

  select *
  into v_session
  from public.live_aunt_minnie_sessions
  where id = p_session_id;

  if not found then
    raise exception 'Live Aunt Minnie session not found.';
  end if;

  if v_session.status in ('completed', 'cancelled') then
    raise exception 'This live Aunt Minnie room is no longer accepting messages.';
  end if;

  return query
  insert into public.live_aunt_minnie_messages (
    session_id,
    prompt_id,
    user_id,
    body
  )
  values (
    p_session_id,
    p_prompt_id,
    auth.uid(),
    v_trimmed_body
  )
  returning *;
end;
$$;

grant execute on function public.submit_live_aunt_minnie_message(uuid, uuid, text) to authenticated;
