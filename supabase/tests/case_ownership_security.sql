-- Structural assertions for explicit case ownership and access grants.
-- Run only after migration in an isolated Supabase development branch.
-- Read-only assertions; no business rows are inserted or modified.

do $$
declare
  v_owner_column boolean;
  v_owner_fk boolean;
  v_access_rls boolean;
  v_select_policy boolean;
  v_insert_policy boolean;
  v_delete_policy boolean;
  v_update_policy boolean;
  v_anon_select boolean;
  v_auth_update boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'case'
      and column_name = 'owner_user_id'
      and data_type = 'uuid'
      and is_nullable = 'YES'
  ) into v_owner_column;

  if not v_owner_column then
    raise exception 'case.owner_user_id must exist and remain nullable during legacy transition';
  end if;

  select exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
     and kcu.constraint_schema = tc.constraint_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
     and ccu.constraint_schema = tc.constraint_schema
    where tc.constraint_schema = 'public'
      and tc.table_name = 'case'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'owner_user_id'
      and ccu.table_schema = 'auth'
      and ccu.table_name = 'users'
      and ccu.column_name = 'id'
  ) into v_owner_fk;

  if not v_owner_fk then
    raise exception 'case.owner_user_id must reference auth.users(id)';
  end if;

  select c.relrowsecurity into v_access_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'case_access';

  if coalesce(v_access_rls, false) is not true then
    raise exception 'RLS must be enabled on case_access';
  end if;

  select exists (select 1 from pg_policies where schemaname='public'
    and tablename='case_access' and policyname='case_access_select_owner_or_member'
    and cmd='SELECT') into v_select_policy;
  select exists (select 1 from pg_policies where schemaname='public'
    and tablename='case_access' and policyname='case_access_insert_owner_only'
    and cmd='INSERT') into v_insert_policy;
  select exists (select 1 from pg_policies where schemaname='public'
    and tablename='case_access' and policyname='case_access_delete_owner_only'
    and cmd='DELETE') into v_delete_policy;
  select exists (select 1 from pg_policies where schemaname='public'
    and tablename='case_access' and cmd='UPDATE') into v_update_policy;

  if not (v_select_policy and v_insert_policy and v_delete_policy) then
    raise exception 'Expected case_access SELECT/INSERT/DELETE policies are missing';
  end if;
  if v_update_policy then
    raise exception 'case_access must not expose direct UPDATE policy';
  end if;

  select has_table_privilege('anon','public.case_access','SELECT')
    into v_anon_select;
  if v_anon_select then
    raise exception 'anon must not SELECT case_access';
  end if;

  select has_table_privilege('authenticated','public.case_access','UPDATE')
    into v_auth_update;
  if v_auth_update then
    raise exception 'authenticated must not UPDATE case_access';
  end if;
end;
$$;

-- Manual behavior tests required in an isolated Supabase environment:
-- 1. anon cannot read/write case_access.
-- 2. owner can see, grant and revoke editor/viewer access.
-- 3. collaborator can see only their own membership row, not other members.
-- 4. editor/viewer cannot grant access or revoke other members.
-- 5. user cannot grant access to themselves.
-- 6. owner_user_id is not writable by authenticated clients during this phase.
-- 7. a case with NULL owner grants no membership-management authority.
-- 8. case/document/embedding remain explicitly NOT certified until the
--    separate coordinated RLS/grants cutover has been applied and tested.
