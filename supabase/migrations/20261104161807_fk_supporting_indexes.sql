-- JurisAI: supporting indexes for remaining foreign keys.
-- Development-only rollout; no data or authorization semantics are changed.

begin;

create index if not exists case_tenente_id_idx
  on public.case (tenente_id)
  where tenente_id is not null;

create index if not exists case_access_granted_by_idx
  on public.case_access (granted_by);

create index if not exists document_created_by_user_id_idx
  on public.document (created_by_user_id)
  where created_by_user_id is not null;

commit;
