-- JurisAI: explicit case ownership and per-case collaboration.
-- REVIEW ONLY. Do not apply to the primary Supabase project yet.
-- owner_user_id remains nullable until legacy ownership and controlled case
-- creation are migrated in a coordinated RLS cutover.

begin;

alter table public.case
  add column if not exists owner_user_id uuid
  references auth.users (id) on delete restrict;

create index if not exists case_owner_user_id_idx
  on public.case (owner_user_id)
  where owner_user_id is not null;

create table if not exists public.case_access (
  case_id uuid not null
    references public.case (id) on delete cascade,
  user_id uuid not null
    references auth.users (id) on delete cascade,
  role text not null
    constraint case_access_role_check
    check (role in ('editor', 'viewer')),
  granted_by uuid not null
    references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (case_id, user_id)
);

create index if not exists case_access_user_id_case_id_idx
  on public.case_access (user_id, case_id);

comment on column public.case.owner_user_id is
  'Explicit technical owner of the case. NULL only for unmigrated legacy rows; never infer from tenente_id.';
comment on table public.case_access is
  'Per-case collaborators. Legal participants are modeled separately and do not receive access implicitly.';

create or replace function public.can_access_case(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.case as c
    where c.id = p_case_id
      and c.owner_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.case_access as ca
    where ca.case_id = p_case_id
      and ca.user_id = (select auth.uid())
  );
$function$;

create or replace function public.can_manage_case_access(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.case as c
    where c.id = p_case_id
      and c.owner_user_id = (select auth.uid())
  );
$function$;

revoke all on function public.can_access_case(uuid) from public;
revoke all on function public.can_access_case(uuid) from anon;
grant execute on function public.can_access_case(uuid) to authenticated;

revoke all on function public.can_manage_case_access(uuid) from public;
revoke all on function public.can_manage_case_access(uuid) from anon;
grant execute on function public.can_manage_case_access(uuid) to authenticated;

alter table public.case_access enable row level security;

drop policy if exists case_access_select_owner_or_member
  on public.case_access;
create policy case_access_select_owner_or_member
  on public.case_access
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.can_manage_case_access(case_id))
  );

drop policy if exists case_access_insert_owner_only
  on public.case_access;
create policy case_access_insert_owner_only
  on public.case_access
  for insert
  to authenticated
  with check (
    granted_by = (select auth.uid())
    and user_id <> (select auth.uid())
    and (select public.can_manage_case_access(case_id))
  );

drop policy if exists case_access_delete_owner_only
  on public.case_access;
create policy case_access_delete_owner_only
  on public.case_access
  for delete
  to authenticated
  using ((select public.can_manage_case_access(case_id)));

-- Intentionally no UPDATE policy: changing collaborator identity or role
-- must be implemented as a separately audited revoke + grant operation.
revoke all on table public.case_access from anon, authenticated;
grant select, insert, delete on table public.case_access to authenticated;

-- IMPORTANT: this migration does not yet enable RLS on public.case or change
-- its existing grants. Do not treat the application as secure for case data
-- until the coordinated cutover migration protects case, document, embedding,
-- tenentes and Storage with complete policies and tested grants.

commit;
