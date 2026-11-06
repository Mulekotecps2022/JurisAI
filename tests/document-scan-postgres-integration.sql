-- Integration contract test in disposable PostgreSQL only.
-- Covers stored object -> atomic enqueue -> lease -> verdict -> document access state.
\set ON_ERROR_STOP on
set role service_role;
do $$
declare
  d uuid; t uuid; ok boolean; n integer; st text;
  verdict text;
begin
  foreach verdict in array array['clean','infected','integrity_failed','retry'] loop
    d := gen_random_uuid();
    insert into public.document(id,status,storage_bucket,storage_path)
      values(d,'quarantined','case-documents','integration/'||d::text);
    insert into storage.objects(bucket_id,name) values('case-documents','integration/'||d::text);
    select public.enqueue_document_scan_job(d) into ok;
    if ok is distinct from true then raise exception 'enqueue failed for %',verdict; end if;
    select c.lease_token into t from public.claim_document_scan_job(180) c where c.document_id=d;
    if t is null then raise exception 'claim failed for %',verdict; end if;
    select public.finish_document_scan_job(d,t,verdict,'ISOLATED_TEST') into ok;
    if ok is distinct from true then raise exception 'finish failed for %',verdict; end if;
    select status into st from public.document where id=d;
    if st <> case when verdict='clean' then 'available'
      when verdict='retry' then 'quarantined' else 'rejected' end then
      raise exception 'wrong document state for %: %',verdict,st;
    end if;
    select public.finish_document_scan_job(d,t,'clean') into ok;
    if ok then raise exception 'replayed token accepted for %',verdict; end if;
    select count(*) into n from public.document_scan_audit
      where document_id=d and event='queued';
    if n<>1 then raise exception 'missing queued audit for %',verdict; end if;
    select count(*) into n from public.document_scan_audit
      where document_id=d and event='claimed';
    if n<>1 then raise exception 'missing claimed audit for %',verdict; end if;
    select count(*) into n from public.document_scan_audit
      where document_id=d and event=verdict;
    if n<>1 then raise exception 'missing verdict audit for %',verdict; end if;
  end loop;
  d:=gen_random_uuid();
  insert into public.document(id,status,storage_bucket,storage_path)
    values(d,'quarantined','case-documents','integration/missing');
  select public.enqueue_document_scan_job(d) into ok;
  if ok then raise exception 'queued absent storage object'; end if;
  select count(*) into n from public.document_scan_jobs where document_id=d;
  if n<>0 then raise exception 'orphan queue job'; end if;
end $$;
reset role;
