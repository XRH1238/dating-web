-- 仅在第二个 Supabase 项目 msrbqgorhjbzxomexzap 的 SQL Editor 中执行。
-- 临时与第一个 Storage 保持一致；登录鉴权完成后必须收紧匿名权限。

drop policy if exists "public read love photos bucket" on storage.objects;
drop policy if exists "public upload love photos bucket" on storage.objects;
drop policy if exists "public delete love photos bucket" on storage.objects;

create policy "public read love photos bucket"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'love-photos');

create policy "public upload love photos bucket"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'love-photos');

create policy "public delete love photos bucket"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'love-photos');
