create or replace function public.create_live_aunt_minnie_session(
  p_title text,
  p_join_code text,
  p_allow_late_join boolean default true,
  p_prompt_count integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.live_aunt_minnie_sessions (
    title,
    created_by,
    host_user_id,
    status,
    current_phase,
    current_prompt_index,
    prompt_count,
    join_code,
    allow_late_join
  ) values (
    p_title,
    auth.uid(),
    auth.uid(),
    'draft',
    'lobby',
    0,
    coalesce(p_prompt_count, 0),
    p_join_code,
    coalesce(p_allow_late_join, true)
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

grant execute on function public.create_live_aunt_minnie_session(text, text, boolean, integer) to anon;
grant execute on function public.create_live_aunt_minnie_session(text, text, boolean, integer) to authenticated;
