-- Primary project only. Run in one maintenance session with the member setup.
-- Existing rows become private; no record, photo, plan or wish is deleted.
begin;

create table if not exists public.love_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.love_members enable row level security;
revoke all on public.love_members from anon, authenticated;
grant select on public.love_members to authenticated;
drop policy if exists "member reads own membership" on public.love_members;
create policy "member reads own membership" on public.love_members
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.is_love_member()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.love_members where user_id = (select auth.uid())); $$;
revoke all on function public.is_love_member() from public;
grant execute on function public.is_love_member() to anon, authenticated;

do $$
declare item text; old_policy record;
begin
  foreach item in array array['love_plans','love_records','love_todos','love_photos','love_capsules'] loop
    execute format('alter table public.%I add column if not exists is_public boolean not null default false', item);
    execute format('alter table public.%I enable row level security', item);
    -- Replace every policy on these five dedicated business tables so an old
    -- permissive policy cannot accidentally preserve anonymous access.
    for old_policy in select policyname from pg_policies where schemaname = 'public' and tablename = item loop
      execute format('drop policy %I on public.%I', old_policy.policyname, item);
    end loop;
    execute format('create policy "selected or member read" on public.%I for select to anon, authenticated using (is_public or (select public.is_love_member()))', item);
    execute format('create policy "members insert" on public.%I for insert to authenticated with check ((select public.is_love_member()))', item);
    execute format('create policy "members update" on public.%I for update to authenticated using ((select public.is_love_member())) with check ((select public.is_love_member()))', item);
    execute format('create policy "members delete" on public.%I for delete to authenticated using ((select public.is_love_member()))', item);
  end loop;
end $$;

alter table public.love_records add column if not exists author_id uuid references auth.users(id);
alter table public.love_records add column if not exists author_name text;
-- Apply the default after the column exists: legacy authors remain unknown.
alter table public.love_records alter column author_id set default auth.uid();
alter table public.love_todos add column if not exists category text not null default '未分类';
alter table public.love_todos add column if not exists completed_on date;
alter table public.love_todos add column if not exists completion_note text;
alter table public.love_todos add column if not exists completion_photos jsonb not null default '[]'::jsonb;
alter table public.love_todos add column if not exists trip_key text;
alter table public.love_photos add column if not exists trip_key text;

-- Capsules always stay private, including their body before unlock.
drop policy "selected or member read" on public.love_capsules;
create policy "member reads capsules" on public.love_capsules for select to authenticated
  using ((select public.is_love_member()));
alter table public.love_capsules drop constraint if exists love_capsules_private;
alter table public.love_capsules add constraint love_capsules_private check (not is_public) not valid;
alter table public.love_capsules validate constraint love_capsules_private;

-- Do not change buckets until the signed-read gateway and frontend are ready.
notify pgrst, 'reload schema';
commit;
