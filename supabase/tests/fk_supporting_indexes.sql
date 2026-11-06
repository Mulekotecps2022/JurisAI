-- Structural assertions for supporting indexes on every audited FK.
-- Run after all migrations in a disposable Supabase-compatible PostgreSQL DB.

do $$
begin
  if to_regclass('public.case_tenente_id_idx') is null then
    raise exception 'Missing index for public.case(tenente_id)';
  end if;
  if to_regclass('public.case_access_granted_by_idx') is null then
    raise exception 'Missing index for public.case_access(granted_by)';
  end if;
  if to_regclass('public.document_created_by_user_id_idx') is null then
    raise exception 'Missing index for public.document(created_by_user_id)';
  end if;
end;
$$;
