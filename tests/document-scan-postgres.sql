-- Only an ephemeral PostgreSQL container. Never run against Supabase.
\set ON_ERROR_STOP on
create role service_role login bypassrls;
create role anon login;
create role authenticated login;
create schema storage;
create table storage.objects(bucket_id text not null,name text not null,primary key(bucket_id,name));
create table public.document(id uuid primary key,status text not null,storage_bucket text,storage_path text);
grant usage on schema public,storage to service_role;
grant all on public.document,storage.objects to service_role;
\i supabase/migrations/20261105_document_scan_queue_draft.sql
grant all on public.document_scan_jobs,public.document_scan_audit to service_role;
grant usage,select on sequence public.document_scan_audit_id_seq to service_role;
insert into public.document values
 ('11111111-1111-4111-8111-111111111111','quarantined','case-documents','case/a'),
 ('22222222-2222-4222-8222-222222222222','quarantined','case-documents','case/b');
insert into storage.objects values ('case-documents','case/a'),('case-documents','case/b');
set role anon;
do $$ begin
  begin
    perform public.enqueue_document_scan_job('11111111-1111-4111-8111-111111111111');
    raise exception 'anon unexpectedly called enqueue';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role service_role;
do $$
declare a boolean; t uuid; n integer;
begin
  select public.enqueue_document_scan_job('11111111-1111-4111-8111-111111111111') into a;
  if a is distinct from true then raise exception 'enqueue failed'; end if;
  select public.enqueue_document_scan_job('11111111-1111-4111-8111-111111111111') into a;
  if a is distinct from false then raise exception 'duplicate enqueue accepted'; end if;
  select count(*) into n from public.document_scan_audit where event='queued';
  if n<>1 then raise exception 'audit mismatch'; end if;
  select lease_token into t from public.claim_document_scan_job(180);
  if t is null then raise exception 'claim missing'; end if;
  select public.finish_document_scan_job('11111111-1111-4111-8111-111111111111',gen_random_uuid(),'clean') into a;
  if a then raise exception 'stale token accepted'; end if;
  select public.finish_document_scan_job('11111111-1111-4111-8111-111111111111',t,'clean') into a;
  if a is distinct from true then raise exception 'valid finish failed'; end if;
  select count(*) into n from public.document where status='available';
  if n<>1 then raise exception 'clean verdict not committed'; end if;
  select count(*) into n from public.document_scan_audit where event='clean';
  if n<>1 then raise exception 'clean audit missing'; end if;
end $$;
reset role;
