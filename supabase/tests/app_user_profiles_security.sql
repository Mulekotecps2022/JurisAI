-- Structural assertions for the app_user_profiles migration.
-- Run only after applying the migration in an isolated Supabase development branch.
-- This file is read-only and does not create or modify application data.

do $$
declare
  v_rls_enabled boolean;
  v_select_policy boolean;
  v_update_policy boolean;
  v_trigger boolean;
  v_insert_privilege boolean;
  v_role_update_privilege boolean;
begin
  select c.relrowsecurity
    into v_rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'app_user_profiles';

  if coalesce(v_rls_enabled, false) is not true then
    raise exception 'RLS must be enabled on app_user_profiles';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_user_profiles'
      and policyname = 'app_user_profiles_select_self_or_admin'
      and cmd = 'SELECT'
  ) into v_select_policy;

  if not v_select_policy then
    raise exception 'Expected self-or-admin SELECT policy is missing';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_user_profiles'
      and policyname = 'app_user_profiles_update_own_display_name'
      and cmd = 'UPDATE'
  ) into v_update_policy;

  if not v_update_policy then
    raise exception 'Expected own-profile UPDATE policy is missing';
  end if;

  select exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth'
      and c.relname = 'users'
      and t.tgname = 'on_auth_user_created_create_profile'
      and not t.tgisinternal
  ) into v_trigger;

  if not v_trigger then
    raise exception 'Auth user profile creation trigger is missing';
  end if;

  select has_table_privilege('authenticated', 'public.app_user_profiles', 'INSERT')
    into v_insert_privilege;

  if v_insert_privilege then
    raise exception 'authenticated must not have INSERT on app_user_profiles';
  end if;

  select has_column_privilege(
    'authenticated',
    'public.app_user_profiles',
    'platform_role',
    'UPDATE'
  ) into v_role_update_privilege;

  if v_role_update_privilege then
    raise exception 'authenticated must not update platform_role';
  end if;
end;
$$;

-- Manual behavior tests still required in an isolated environment:
-- 1. anon cannot SELECT or mutate app_user_profiles.
-- 2. user A can SELECT and update only their own display_name.
-- 3. user A cannot INSERT, DELETE, or change platform_role.
-- 4. user B cannot read user A's profile.
-- 5. platform_admin can SELECT profiles but cannot thereby read case/document data.
-- 6. a newly invited Auth user receives platform_role='user' from the trigger.
