-- 仅在第二个 Supabase Storage 项目的 SQL Editor 执行。
-- Bucket 继续保持 Public，已知公开 URL 仍可读；浏览器不再获得列表、上传、更新或删除权限。
-- Storage Gateway 使用仅保存在 Edge Function 环境变量中的服务端 secret 绕过 RLS。

drop policy if exists "public read love photos bucket" on storage.objects;
drop policy if exists "public upload love photos bucket" on storage.objects;
drop policy if exists "public update love photos bucket" on storage.objects;
drop policy if exists "public delete love photos bucket" on storage.objects;
