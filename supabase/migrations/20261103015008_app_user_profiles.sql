-- JurisAI: application profiles and platform-level role.
-- Applied to JurisAI-Desenvolvimento as migration 20261103015008.
-- Initial platform-admin promotion is a separate controlled data operation.

begin;

create table if not exists public.app_user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  platform_role text not null default 'user'
    constraint app_user_profiles_platform_role_check
    check (platform_role in ('user', 'platform_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.app_user_profiles is
  'Application profile and platform-level role; distinct from case ownership and legal participants.';
comment on column public.app_user_profiles.platform_role is
  'Platform administration only. Does not grant access to cases, documents, or embeddings.';

-- Existing Auth identities receive the least-privileged role. The confirmed
-- initial administrator is promoted separately through the controlled bootstrap.
insert into public.app_user_profiles (user_id)
select u.id
from auth.users as u
on conflict (user_id) do nothing;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.app_user_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.platform_role = 'platform_admin'
  );
$function$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.is_platform_admin() from anon;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.set_app_user_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function public.set_app_user_profile_updated_at() from public;
revoke all on function public.set_app_user_profile_updated_at() from anon, authenticated;

drop trigger if exists set_app_user_profiles_updated_at
  on public.app_user_profiles;
create trigger set_app_user_profiles_updated_at
  before update on public.app_user_profiles
  for each row execute function public.set_app_user_profile_updated_at();

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.app_user_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

revoke all on function public.handle_new_auth_user_profile() from public;
revoke all on function public.handle_new_auth_user_profile() from anon, authenticated;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user_profile();

alter table public.app_user_profiles enable row level security;

drop policy if exists app_user_profiles_select_self_or_admin
  on public.app_user_profiles;
create policy app_user_profiles_select_self_or_admin
  on public.app_user_profiles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_platform_admin())
  );

drop policy if exists app_user_profiles_update_own_display_name
  on public.app_user_profiles;
create policy app_user_profiles_update_own_display_name
  on public.app_user_profiles
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- No client-side INSERT, DELETE, or UPDATE of platform_role.
revoke all on table public.app_user_profiles from anon, authenticated;
grant select on table public.app_user_profiles to authenticated;
grant update (display_name) on table public.app_user_profiles to authenticated;

commit;
