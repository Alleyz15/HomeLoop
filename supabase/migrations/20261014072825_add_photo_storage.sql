insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do update
set public = false;

create policy "Users can upload photos in their own folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can read photos in their own folder"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete photos in their own folder"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Admins can read all photos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'photos'
    and (select private.is_admin())
  );
