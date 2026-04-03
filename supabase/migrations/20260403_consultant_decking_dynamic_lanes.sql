create table if not exists public.consultant_decking_tabs (
  id text primary key,
  title text not null check (length(trim(title)) > 0 and length(trim(title)) <= 64),
  description text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  max_lanes integer not null default 4 check (max_lanes between 1 and 4),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.consultant_decking_tabs (id, title, description, sort_order, is_active, max_lanes)
values
  ('tab-1', 'Fuente 7AM-7AM Sun-Sat', 'Primary Fuente duty deck', 0, true, 4),
  ('tab-2', 'Mandaue 7AM-7AM Sun-Sat', 'Primary Mandaue duty deck', 1, true, 4),
  ('tab-3', 'Special and Overflow Deck', 'Backup, overflow, or special coverage cases', 2, true, 4)
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = true,
    max_lanes = excluded.max_lanes;

create table if not exists public.consultant_decking_lanes (
  id text primary key,
  tab_id text not null references public.consultant_decking_tabs(id) on delete cascade,
  label text not null check (length(trim(label)) > 0 and length(trim(label)) <= 48),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  accent_token text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.consultant_decking_entries
  add column if not exists tab_id text,
  add column if not exists lane_id text,
  add column if not exists brief_impression text,
  add column if not exists priority_level text default 'routine';

update public.consultant_decking_entries
set tab_id = coalesce(tab_id, 'tab-1'),
    lane_id = coalesce(lane_id, column_key, 'inbox'),
    priority_level = coalesce(priority_level, 'routine');

alter table public.consultant_decking_entries
  alter column tab_id set default 'tab-1',
  alter column lane_id set default 'inbox',
  alter column priority_level set default 'routine';

insert into public.consultant_decking_lanes (id, tab_id, label, sort_order, is_active, accent_token)
values
  ('inbox', 'tab-1', 'Unassigned patients', 0, true, 'slate'),
  ('reynes', 'tab-1', 'Dr. Reynes', 1, true, 'violet'),
  ('alvarez', 'tab-1', 'Dr. Alvarez', 2, true, 'amber'),
  ('co-ng', 'tab-1', 'Dr. Co-Ng', 3, true, 'emerald'),
  ('vano-yu', 'tab-1', 'Dr. Vano-Yu', 4, true, 'rose'),
  ('inbox-tab-2', 'tab-2', 'Unassigned patients', 0, true, 'slate'),
  ('inbox-tab-3', 'tab-3', 'Unassigned patients', 0, true, 'slate')
on conflict (id) do update
set tab_id = excluded.tab_id,
    label = excluded.label,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    accent_token = excluded.accent_token;

alter table public.consultant_decking_entries
  alter column tab_id set not null,
  alter column lane_id set not null,
  alter column priority_level set not null;

alter table public.consultant_decking_entries
  drop constraint if exists consultant_decking_entries_lane_id_fkey;

alter table public.consultant_decking_entries
  add constraint consultant_decking_entries_lane_id_fkey
  foreign key (lane_id) references public.consultant_decking_lanes(id) on delete restrict;

alter table public.consultant_decking_entries
  drop constraint if exists consultant_decking_entries_tab_id_fkey;

alter table public.consultant_decking_entries
  add constraint consultant_decking_entries_tab_id_fkey
  foreign key (tab_id) references public.consultant_decking_tabs(id) on delete restrict;

alter table public.consultant_decking_entries
  drop constraint if exists consultant_decking_entries_priority_level_check;

alter table public.consultant_decking_entries
  add constraint consultant_decking_entries_priority_level_check
  check (priority_level in ('routine', 'priority', 'urgent', 'stat'));

create table if not exists public.archived_consultant_decking_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  entries_snapshot jsonb not null default '[]'::jsonb,
  lanes_snapshot jsonb not null default '[]'::jsonb,
  tabs_snapshot jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
