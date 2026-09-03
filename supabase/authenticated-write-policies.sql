-- 仅在主 Supabase 项目的 SQL Editor 执行。
-- 保留公开读取，数据库写入只允许主项目 Auth 的 authenticated 用户。

alter table public.love_plans enable row level security;

drop policy if exists "public read plans" on public.love_plans;
drop policy if exists "public insert plans" on public.love_plans;
drop policy if exists "public update plans" on public.love_plans;
drop policy if exists "public delete plans" on public.love_plans;
drop policy if exists "public read love_plans" on public.love_plans;
drop policy if exists "authenticated insert love_plans" on public.love_plans;
drop policy if exists "authenticated update love_plans" on public.love_plans;
drop policy if exists "authenticated delete love_plans" on public.love_plans;

create policy "public read love_plans"
on public.love_plans for select to anon, authenticated
using (true);

create policy "authenticated insert love_plans"
on public.love_plans for insert to authenticated
with check (true);

create policy "authenticated update love_plans"
on public.love_plans for update to authenticated
using (true) with check (true);

create policy "authenticated delete love_plans"
on public.love_plans for delete to authenticated
using (true);

alter table public.love_records enable row level security;

drop policy if exists "public read records" on public.love_records;
drop policy if exists "public insert records" on public.love_records;
drop policy if exists "public update records" on public.love_records;
drop policy if exists "public delete records" on public.love_records;
drop policy if exists "public read love_records" on public.love_records;
drop policy if exists "authenticated insert love_records" on public.love_records;
drop policy if exists "authenticated update love_records" on public.love_records;
drop policy if exists "authenticated delete love_records" on public.love_records;

create policy "public read love_records"
on public.love_records for select to anon, authenticated
using (true);

create policy "authenticated insert love_records"
on public.love_records for insert to authenticated
with check (true);

create policy "authenticated update love_records"
on public.love_records for update to authenticated
using (true) with check (true);

create policy "authenticated delete love_records"
on public.love_records for delete to authenticated
using (true);

alter table public.love_todos enable row level security;

drop policy if exists "public read todos" on public.love_todos;
drop policy if exists "public insert todos" on public.love_todos;
drop policy if exists "public update todos" on public.love_todos;
drop policy if exists "public delete todos" on public.love_todos;
drop policy if exists "public read love_todos" on public.love_todos;
drop policy if exists "authenticated insert love_todos" on public.love_todos;
drop policy if exists "authenticated update love_todos" on public.love_todos;
drop policy if exists "authenticated delete love_todos" on public.love_todos;

create policy "public read love_todos"
on public.love_todos for select to anon, authenticated
using (true);

create policy "authenticated insert love_todos"
on public.love_todos for insert to authenticated
with check (true);

create policy "authenticated update love_todos"
on public.love_todos for update to authenticated
using (true) with check (true);

create policy "authenticated delete love_todos"
on public.love_todos for delete to authenticated
using (true);

alter table public.love_photos enable row level security;

drop policy if exists "public read photos" on public.love_photos;
drop policy if exists "public insert photos" on public.love_photos;
drop policy if exists "public update photos" on public.love_photos;
drop policy if exists "public delete photos" on public.love_photos;
drop policy if exists "public read love_photos" on public.love_photos;
drop policy if exists "authenticated insert love_photos" on public.love_photos;
drop policy if exists "authenticated update love_photos" on public.love_photos;
drop policy if exists "authenticated delete love_photos" on public.love_photos;

create policy "public read love_photos"
on public.love_photos for select to anon, authenticated
using (true);

create policy "authenticated insert love_photos"
on public.love_photos for insert to authenticated
with check (true);

create policy "authenticated update love_photos"
on public.love_photos for update to authenticated
using (true) with check (true);

create policy "authenticated delete love_photos"
on public.love_photos for delete to authenticated
using (true);

alter table public.love_capsules enable row level security;

drop policy if exists "Public read love_capsules" on public.love_capsules;
drop policy if exists "Public insert love_capsules" on public.love_capsules;
drop policy if exists "Public update love_capsules" on public.love_capsules;
drop policy if exists "Public delete love_capsules" on public.love_capsules;
drop policy if exists "public read love_capsules" on public.love_capsules;
drop policy if exists "authenticated insert love_capsules" on public.love_capsules;
drop policy if exists "authenticated update love_capsules" on public.love_capsules;
drop policy if exists "authenticated delete love_capsules" on public.love_capsules;

create policy "public read love_capsules"
on public.love_capsules for select to anon, authenticated
using (true);

create policy "authenticated insert love_capsules"
on public.love_capsules for insert to authenticated
with check (true);

create policy "authenticated update love_capsules"
on public.love_capsules for update to authenticated
using (true) with check (true);

create policy "authenticated delete love_capsules"
on public.love_capsules for delete to authenticated
using (true);
