-- Create announcements table
create table announcements (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  category text not null check (category in ('Research', 'Announcement', 'Event', 'Clinical')),
  author_id uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  image_url text,
  pinned boolean default false,
  views integer default 0
);

-- Enable RLS
alter table announcements enable row level security;

-- Policies
create policy "Announcements are viewable by everyone"
  on announcements for select
  using ( true );

create policy "Authenticated users can insert announcements"
  on announcements for insert
  with check ( auth.role() = 'authenticated' );

create policy "Users can update their own announcements"
  on announcements for update
  using ( auth.uid() = author_id );

-- Storage bucket for announcement images
insert into storage.buckets (id, name, public) 
values ('announcement-images', 'announcement-images', true)
on conflict (id) do nothing;

create policy "Announcement images are viewable by everyone"
  on storage.objects for select
  using ( bucket_id = 'announcement-images' );

create policy "Authenticated users can upload announcement images"
  on storage.objects for insert
  with check ( bucket_id = 'announcement-images' and auth.role() = 'authenticated' );
