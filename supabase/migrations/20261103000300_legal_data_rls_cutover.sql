-- JurisAI: coordinated RLS and least-privilege cutover for legal data.
-- REVIEW ONLY. Depends on migrations:
--   20261103000100_app_user_profiles.sql
--   20261103000200_case_ownership_and_access.sql
-- Apply only in an isolated Supabase development branch after review.
-- This does not configure Storage policies or grant platform-admin access
-- to legal records.

begin;

-- Preserve legacy people rows without inventing an owner. NULL means the
-- legacy record is unassigned and is not directly visible to app users.
alter table public.tenentes
  add column if not exists created_by_user_id uuid
  references auth.users (id) on delete restrict;

create index if not exists tenentes_created_by_user_id_idx
  on public.tenentes (created_by_user_id)
  where created_by_user_id is not null;

create table if not exists public.case_participants (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.case (id) on delete cascade,
  tenente_id uuid not null references public.tenentes (id) on delete restrict,
  role text not null
    constraint case_participants_role_check
    check (role in (
      'client', 'plaintiff', 'defendant', 'lawyer', 'responsible',
      'partner', 'witness', 'expert', 'other'
    )),
  notes text,
  created_at timestamptz not null default now(),
  unique (case_id, tenente_id, role)
);

create index if not exists case_participants_tenente_case_idx
  on public.case_participants (tenente_id, case_id);
create index if not exists case_participants_case_idx
  on public.case_participants (case_id);

-- Documents and embeddings must always be anchored to a case.
-- The schema audit found zero rows in both tables before this migration.
alter table public.document
  alter column case_id set not null;
alter table public.embedding
  alter column document_id set not null;

create index if not exists document_case_id_idx
  on public.document (case_id);
create index if not exists embedding_document_id_idx
  on public.embedding (document_id);

comment on column public.tenentes.created_by_user_id is
  'Creator of the shared legal-person record. NULL preserves unassigned legacy records.';
comment on table public.case_participants is
  'Legal roles of people/entities in a case. This relation grants no technical access by itself.';

-- Case read and edit checks are SECURITY DEFINER to avoid policy recursion.
create or replace function public.can_edit_case(p_case_id uuid)
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
      and ca.role = 'editor'
  );
$function$;

create or replace function public.can_access_tenente(p_tenente_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.tenentes as t
    where t.id = p_tenente_id
      and t.created_by_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.case_participants as cp
    join public.case as c on c.id = cp.case_id
    where cp.tenente_id = p_tenente_id
      and public.can_access_case(c.id)
  );
$function$;

revoke all on function public.can_edit_case(uuid) from public;
revoke all on function public.can_edit_case(uuid) from anon;
grant execute on function public.can_edit_case(uuid) to authenticated;

revoke all on function public.can_access_tenente(uuid) from public;
revoke all on function public.can_access_tenente(uuid) from anon;
grant execute on function public.can_access_tenente(uuid) to authenticated;

-- RLS on every legal-data table.
alter table public.case enable row level security;
alter table public.tenentes enable row level security;
alter table public.case_participants enable row level security;
alter table public.document enable row level security;
alter table public.embedding enable row level security;

-- CASE (uppercase) is a separate, unexplained legacy table. Keep it closed:
-- RLS was already enabled and no policies are intentionally created.
revoke all on table public."CASE" from anon, authenticated;

-- CASE: owner and explicit collaborators only. Owner identity cannot be
-- changed by authenticated clients because it is not in the UPDATE grant.
drop policy if exists case_select_authorized on public.case;
create policy case_select_authorized
  on public.case for select to authenticated
  using ((select public.can_access_case(id)));

drop policy if exists case_insert_self_as_owner on public.case;
create policy case_insert_self_as_owner
  on public.case for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

drop policy if exists case_update_owner_or_editor on public.case;
create policy case_update_owner_or_editor
  on public.case for update to authenticated
  using ((select public.can_edit_case(id)))
  with check ((select public.can_edit_case(id)));

-- No client DELETE policy/grant: process deletion requires a separate
-- audited server-side workflow.
revoke all on table public.case from anon, authenticated;
grant select on table public.case to authenticated;
grant insert (owner_user_id, title, description)
  on table public.case to authenticated;
grant update (title, description)
  on table public.case to authenticated;

-- TENENTES: records are visible to their creator or through a case the
-- current user can access. The unassigned legacy row stays hidden.
drop policy if exists tenentes_select_authorized on public.tenentes;
create policy tenentes_select_authorized
  on public.tenentes for select to authenticated
  using ((select public.can_access_tenente(id)));

drop policy if exists tenentes_insert_self on public.tenentes;
create policy tenentes_insert_self
  on public.tenentes for insert to authenticated
  with check (created_by_user_id = (select auth.uid()));

drop policy if exists tenentes_update_creator_only on public.tenentes;
create policy tenentes_update_creator_only
  on public.tenentes for update to authenticated
  using (created_by_user_id = (select auth.uid()))
  with check (created_by_user_id = (select auth.uid()));

drop policy if exists tenentes_delete_creator_only on public.tenentes;
create policy tenentes_delete_creator_only
  on public.tenentes for delete to authenticated
  using (created_by_user_id = (select auth.uid()));

revoke all on table public.tenentes from anon, authenticated;
grant select on table public.tenentes to authenticated;
grant insert (name, created_by_user_id)
  on public.tenentes to authenticated;
grant update (name) on public.tenentes to authenticated;
-- Deliberately no DELETE grant for shared person records.

-- LEGAL PARTICIPANTS: visible only to users with access to the linked case.
drop policy if exists case_participants_select_case_access
  on public.case_participants;
create policy case_participants_select_case_access
  on public.case_participants for select to authenticated
  using ((select public.can_access_case(case_id)));

drop policy if exists case_participants_insert_editor
  on public.case_participants;
create policy case_participants_insert_editor
  on public.case_participants for insert to authenticated
  with check (
    (select public.can_edit_case(case_id))
    and (select public.can_access_tenente(tenente_id))
  );

drop policy if exists case_participants_update_editor
  on public.case_participants;
create policy case_participants_update_editor
  on public.case_participants for update to authenticated
  using ((select public.can_edit_case(case_id)))
  with check (
    (select public.can_edit_case(case_id))
    and (select public.can_access_tenente(tenente_id))
  );

drop policy if exists case_participants_delete_editor
  on public.case_participants;
create policy case_participants_delete_editor
  on public.case_participants for delete to authenticated
  using ((select public.can_edit_case(case_id)));

revoke all on table public.case_participants from anon, authenticated;
grant select, insert, delete on table public.case_participants to authenticated;
grant update (role, notes) on table public.case_participants to authenticated;

-- DOCUMENTS: inherit access from the owning case. Viewers can read;
-- owners/editors can add/update; only owners can delete.
drop policy if exists document_select_case_access on public.document;
create policy document_select_case_access
  on public.document for select to authenticated
  using ((select public.can_access_case(case_id)));

drop policy if exists document_insert_editor on public.document;
create policy document_insert_editor
  on public.document for insert to authenticated
  with check ((select public.can_edit_case(case_id)));

drop policy if exists document_update_editor on public.document;
create policy document_update_editor
  on public.document for update to authenticated
  using ((select public.can_edit_case(case_id)))
  with check ((select public.can_edit_case(case_id)));

drop policy if exists document_delete_owner on public.document;
create policy document_delete_owner
  on public.document for delete to authenticated
  using ((select public.can_manage_case_access(case_id)));

revoke all on table public.document from anon, authenticated;
grant select on table public.document to authenticated;
grant insert (case_id, file_name, file_path)
  on public.document to authenticated;
grant update (file_name, file_path)
  on public.document to authenticated;
grant delete on table public.document to authenticated;

-- EMBEDDINGS: authenticated users receive read-only access inherited from
-- document -> case. Writes are reserved for trusted server/service workflows.
drop policy if exists embedding_select_case_access on public.embedding;
create policy embedding_select_case_access
  on public.embedding for select to authenticated
  using (
    exists (
      select 1
      from public.document as d
      where d.id = embedding.document_id
        and (select public.can_access_case(d.case_id))
    )
  );

revoke all on table public.embedding from anon, authenticated;
grant select on table public.embedding to authenticated;

-- Reassert least-privilege access for the collaborator relation.
revoke all on table public.case_access from anon, authenticated;
grant select, insert, delete on table public.case_access to authenticated;

commit;
