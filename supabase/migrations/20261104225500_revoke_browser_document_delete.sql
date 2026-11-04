-- Align browser privileges with the private server-mediated document workflow.
-- Authenticated users may read authorized document metadata through RLS.
-- All document writes and deletes are performed by trusted server workflows.

begin;

revoke delete on table public.document from authenticated;

commit;
