-- Additional isolated database tests: lease expiry, recovery, terminal failure,
-- transaction rollback, permissions and audit consistency.
\set ON_ERROR_STOP on
set role service_role;
do $$
declare d uuid := '22222222-2222-4222-8222-222222222222'; t1 uuid; t2 uuid; ok boolean; n integer;
begin
  select public.enqueue_document_scan_job(d) into ok;
  if ok is distinct from true then raise exception 'enqueue b failed'; end if;
  select c.lease_token into t1 from public.claim_document_scan_job(30) c where c.document_id=d;
  if t1 is null then raise exception 'initial claim missing'; end if;
  update public.document_scan_jobs set lease_until=now()-interval '1 second' where document_id=d;
  select c.lease_token into t2 from public.claim_document_scan_job(30) c where c.document_id=d;
  if t2 is null or t1=t2 then raise exception 'lease was not renewed'; end if;
  select public.finish_document_scan_job(d,t1,'clean') into ok;
  if ok then raise exception 'expired worker authorized'; end if;
  select count(*) into n from public.document_scan_audit where document_id=d and event='recovered';
  if n<>1 then raise exception 'missing recovery audit'; end if;
  update public.document_scan_jobs set lease_until=now()-interval '1 second',attempts=5 where document_id=d;
  perform 1 from public.claim_document_scan_job(30);
  select count(*) into n from public.document_scan_jobs where document_id=d and state='dead';
  if n<>1 then raise exception 'exhausted job not dead'; end if;
  select count(*) into n from public.document_scan_audit where document_id=d and event='dead';
  if n<>1 then raise exception 'missing dead audit'; end if;
  select count(*) into n from public.document where id=d and status='quarantined';
  if n<>1 then raise exception 'dead job released document'; end if;
end $$;
reset role;
-- Trigger an audit insertion failure; enqueue must roll back completely.
insert into public.document values ('33333333-3333-4333-8333-333333333333','quarantined','case-documents','case/c');
insert into storage.objects values ('case-documents','case/c');
create or replace function public.reject_test_audit() returns trigger language plpgsql as $$
begin if new.document_id='33333333-3333-4333-8333-333333333333' then raise exception 'injected audit failure'; end if; return new; end $$;
create trigger reject_test_audit before insert on public.document_scan_audit for each row execute function public.reject_test_audit();
set role service_role;
do $$
declare n integer; did_fail boolean := false;
begin
  begin
    perform public.enqueue_document_scan_job('33333333-3333-4333-8333-333333333333');
  exception when raise_exception then did_fail := true;
  end;
  if not did_fail then raise exception 'injected audit error not propagated'; end if;
  select count(*) into n from public.document_scan_jobs where document_id='33333333-3333-4333-8333-333333333333';
  if n<>0 then raise exception 'non-atomic enqueue'; end if;
end $$;
reset role;
drop trigger reject_test_audit on public.document_scan_audit;
drop function public.reject_test_audit();
set role authenticated;
do $$
begin
  begin
    perform public.claim_document_scan_job(30);
    raise exception 'authenticated could claim';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
