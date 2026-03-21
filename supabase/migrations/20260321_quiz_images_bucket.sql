alter table public.quiz_questions
  add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('quiz-images', 'quiz-images', true)
on conflict (id) do nothing;

drop policy if exists "Quiz images are viewable by everyone" on storage.objects;
create policy "Quiz images are viewable by everyone"
  on storage.objects for select
  using (bucket_id = 'quiz-images');

drop policy if exists "Authenticated users can upload quiz images" on storage.objects;
create policy "Authenticated users can upload quiz images"
  on storage.objects for insert
  with check (bucket_id = 'quiz-images' and auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update quiz images" on storage.objects;
create policy "Authenticated users can update quiz images"
  on storage.objects for update
  using (bucket_id = 'quiz-images' and auth.role() = 'authenticated')
  with check (bucket_id = 'quiz-images' and auth.role() = 'authenticated');
