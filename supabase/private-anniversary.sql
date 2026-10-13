-- Primary project. Populate the existing relationship date through the private
-- SQL Editor; do not put the couple's date into the public source repository.
begin;
create table if not exists public.love_site_settings (
  singleton boolean primary key default true check (singleton),
  love_start_date date not null
);
alter table public.love_site_settings enable row level security;
revoke all on public.love_site_settings from anon, authenticated;
grant select on public.love_site_settings to authenticated;
drop policy if exists "members read relationship settings" on public.love_site_settings;
create policy "members read relationship settings" on public.love_site_settings for select to authenticated
  using ((select public.is_love_member()));
create or replace function public.get_love_start_date()
returns date language sql stable security invoker set search_path = ''
as $$ select love_start_date from public.love_site_settings where singleton; $$;
revoke all on function public.get_love_start_date() from public;
grant execute on function public.get_love_start_date() to authenticated;
notify pgrst, 'reload schema';
commit;
