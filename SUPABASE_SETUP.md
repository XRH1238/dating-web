# Supabase setup

在 Supabase Dashboard 的 SQL Editor 里执行下面的 SQL。这个版本适合两个人的小站原型：不用登录，任何打开网站的人都可以读写这些数据。

```sql
create table if not exists public.love_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.love_records (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.love_todos (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.love_photos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  path text not null,
  url text not null,
  created_at timestamptz not null default now()
);

alter table public.love_plans enable row level security;
alter table public.love_records enable row level security;
alter table public.love_todos enable row level security;
alter table public.love_photos enable row level security;

create policy "public read plans" on public.love_plans for select using (true);
create policy "public insert plans" on public.love_plans for insert with check (true);
create policy "public update plans" on public.love_plans for update using (true) with check (true);
create policy "public delete plans" on public.love_plans for delete using (true);

create policy "public read records" on public.love_records for select using (true);
create policy "public insert records" on public.love_records for insert with check (true);
create policy "public update records" on public.love_records for update using (true) with check (true);
create policy "public delete records" on public.love_records for delete using (true);

create policy "public read todos" on public.love_todos for select using (true);
create policy "public insert todos" on public.love_todos for insert with check (true);
create policy "public update todos" on public.love_todos for update using (true) with check (true);
create policy "public delete todos" on public.love_todos for delete using (true);

create policy "public read photos" on public.love_photos for select using (true);
create policy "public insert photos" on public.love_photos for insert with check (true);
create policy "public update photos" on public.love_photos for update using (true) with check (true);
create policy "public delete photos" on public.love_photos for delete using (true);

insert into storage.buckets (id, name, public)
values ('love-photos', 'love-photos', true)
on conflict (id) do update set public = true;

create policy "public read love photos bucket"
on storage.objects for select
using (bucket_id = 'love-photos');

create policy "public upload love photos bucket"
on storage.objects for insert
with check (bucket_id = 'love-photos');

create policy "public delete love photos bucket"
on storage.objects for delete
using (bucket_id = 'love-photos');
```

如果以后要做成只有你和女朋友能编辑，下一步应该加 Supabase Auth 登录，再把这些 `public` 策略改成只允许指定用户读写。
