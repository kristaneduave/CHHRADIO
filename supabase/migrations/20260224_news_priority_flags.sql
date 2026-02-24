-- Normalize forum-style priority flags for announcements.
alter table public.announcements
  add column if not exists is_pinned boolean not null default false,
  add column if not exists is_important boolean not null default false,
  add column if not exists pinned_at timestamp with time zone;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'announcements'
      and column_name = 'pinned'
  ) then
    execute $sql$
      update public.announcements
      set
        is_pinned = coalesce(is_pinned, false) or coalesce(pinned, false),
        pinned_at = case
          when (coalesce(is_pinned, false) or coalesce(pinned, false)) and pinned_at is null then created_at
          else pinned_at
        end
    $sql$;
  end if;
end $$;

create index if not exists announcements_priority_created_idx
  on public.announcements (is_pinned desc, is_important desc, created_at desc);
