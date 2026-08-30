-- 为照片墙保存实况照片的静态图与动态视频引用。
-- 所有字段均可为空，旧数据和普通照片无需迁移内容。
alter table public.love_photos add column if not exists type text;
alter table public.love_photos add column if not exists media_kind text;
alter table public.love_photos add column if not exists motion_name text;
alter table public.love_photos add column if not exists motion_type text;
alter table public.love_photos add column if not exists motion_path text;
alter table public.love_photos add column if not exists motion_url text;
