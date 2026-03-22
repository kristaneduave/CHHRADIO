alter table public.live_aunt_minnie_messages
  drop constraint if exists live_aunt_minnie_messages_user_id_fkey;

alter table public.live_aunt_minnie_messages
  add constraint live_aunt_minnie_messages_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
