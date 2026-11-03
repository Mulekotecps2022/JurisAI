-- Structural assertions for the coordinated legal-data RLS cutover.
-- Run only after applying the migration in an isolated Supabase environment.
-- These checks do not replace the multi-user behavioral tests below.

do $$
declare
  tbl text;
  rls boolean;
  v_policy_count integer;
begin
  foreach tbl in array array[
    'case', 'tenentes', 'case_participants', 'document', 'embedding'
  ] loop
    select c.relrowsecurity into rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = tbl;

    if coalesce(rls, false) is not true then
      raise exception 'RLS is not enabled on public.%', tbl;
    end if;
  end loop;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('case','tenentes','case_participants','document','embedding')
    and roles @> array['authenticated']::name[];

  if v_policy_count < 13 then
    raise exception 'Expected legal-data policies are incomplete; found %', v_policy_count;
  end if;

  if has_table_privilege('anon','public.case','SELECT')
     or has_table_privilege('anon','public.tenentes','SELECT')
     or has_table_privilege('anon','public.document','SELECT')
     or has_table_privilege('anon','public.embedding','SELECT') then
    raise exception 'anon retains table-level SELECT on legal data';
  end if;

  if has_table_privilege('authenticated','public.embedding','INSERT')
     or has_table_privilege('authenticated','public.embedding','UPDATE')
     or has_table_privilege('authenticated','public.embedding','DELETE') then
    raise exception 'authenticated must remain read-only for embeddings';
  end if;

  if has_column_privilege('authenticated','public.case','owner_user_id','UPDATE') then
    raise exception 'authenticated must not UPDATE case.owner_user_id';
  end if;

  if has_column_privilege('authenticated','public.case','tenente_id','INSERT') then
    raise exception 'legacy tenente_id must not be assigned through the case client insert';
  end if;

  if has_column_privilege('authenticated','public.document','case_id','UPDATE') then
    raise exception 'authenticated must not move documents between cases';
  end if;

  if has_table_privilege('authenticated','public."CASE"','SELECT') then
    raise exception 'unmapped uppercase CASE table must remain closed';
  end if;
end;
$$;

-- Required manual tests using at least three separate Auth identities:
-- A. anon cannot select/insert/update/delete any legal-data table.
-- B. owner creates a case; owner can read/update it and add participants/docs.
-- C. unrelated user cannot discover the case by UUID, nor read documents or
--    embeddings belonging to it.
-- D. editor can read/update case, participants and documents, but cannot
--    grant/revoke collaborators, delete documents, or change owner_user_id.
-- E. viewer can read case, participants, documents and embeddings only.
-- F. after revocation, collaborator loses access to case/document/embedding.
-- G. creator of a tenentes record can see/edit it; other users see it only
--    through an accessible case and cannot globally rename it.
-- H. the pre-existing unassigned tenentes row remains unexposed until an
--    explicit ownership/visibility decision is made.
-- I. clients cannot insert orphan documents or embeddings.
-- J. clients cannot move documents to another case or reassign participants
--    to a case they cannot edit.
-- K. platform_admin without case ownership/membership has no case-content
--    access merely by virtue of the platform role.
-- L. all application queries, including AI retrieval, apply case authorization.
