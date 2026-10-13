-- Run on BOTH projects, after the primary database migration and gateway deploy.
-- Restrict only love-photos. Other buckets retain their existing policies.
begin;
update storage.buckets set public = false where id = 'love-photos';
drop policy if exists "private love photos browser guard" on storage.objects;
create policy "private love photos browser guard" on storage.objects
  as restrictive for all to anon, authenticated
  using (bucket_id <> 'love-photos') with check (bucket_id <> 'love-photos');
commit;
