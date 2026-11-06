-- Draft migration: apply to development only after review.
-- Jobs and append-only audit events. No client grants, no browser access.
create table if not exists public.document_scan_jobs (
  document_id uuid primary key references public.document(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','processing','completed','rejected','dead')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  lease_token uuid,
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists document_scan_jobs_due_idx
  on public.document_scan_jobs(next_attempt_at) where state='pending';
alter table public.document_scan_jobs enable row level security;
revoke all on public.document_scan_jobs from public, anon, authenticated;

create table if not exists public.document_scan_audit (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.document(id) on delete cascade,
  event text not null check (event in ('queued','claimed','clean','infected','retry','dead','integrity_failed','recovered')),
  engine text,
  engine_version text,
  signature_version text,
  detail_code text,
  created_at timestamptz not null default now()
);
create index if not exists document_scan_audit_document_idx
  on public.document_scan_audit(document_id, created_at desc);
alter table public.document_scan_audit enable row level security;
revoke all on public.document_scan_audit from public, anon, authenticated;

-- Service-role-only RPCs. No SECURITY DEFINER: service_role already has the
-- required table privileges, and the API key must remain server-side.
-- Explicitly revoke PUBLIC, including the no-argument default invocation.
create or replace function public.claim_document_scan_job(p_lease_seconds integer default 180)
returns table(document_id uuid, attempts integer, lease_token uuid)
language plpgsql security invoker set search_path=''
as $$
declare v_id uuid; v_attempts integer; v_token uuid;
begin
  if current_user <> 'service_role' then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 600 then
    raise exception 'invalid lease';
  end if;
  -- Recovery never releases a document: it remains quarantined or scanning
  -- and cannot be downloaded while awaiting another attempt.
  with recovered as (
    update public.document_scan_jobs j set
    state='pending', lease_until=null, lease_token=null,
    next_attempt_at=now(), updated_at=now(), last_error_code='LEASE_EXPIRED'
    where j.state='processing' and j.lease_until < now() and j.attempts < 5
    returning j.document_id
  )
  insert into public.document_scan_audit(document_id,event,detail_code)
    select document_id,'recovered','LEASE_EXPIRED' from recovered;
  with exhausted as (
    update public.document_scan_jobs j set
    state='dead', lease_until=null, lease_token=null,
    updated_at=now(), last_error_code='LEASE_EXHAUSTED'
    where j.state='processing' and j.lease_until < now() and j.attempts >= 5
    returning j.document_id
  )
  insert into public.document_scan_audit(document_id,event,detail_code)
    select document_id,'dead','LEASE_EXHAUSTED' from exhausted;
  -- A single UPDATE with SKIP LOCKED makes the claim atomic.
  with candidate as (
    select j.document_id from public.document_scan_jobs j
    join public.document d on d.id=j.document_id
    where j.state='pending' and j.next_attempt_at<=now()
      and j.attempts<5 and d.status in ('quarantined','scanning')
    order by j.next_attempt_at,j.created_at
    for update of j skip locked limit 1
  )
  update public.document_scan_jobs j set
    state='processing', attempts=j.attempts+1,
    lease_token=gen_random_uuid(),
    lease_until=now()+make_interval(secs=>p_lease_seconds),
    updated_at=now()
  from candidate where j.document_id=candidate.document_id
  returning j.document_id,j.attempts,j.lease_token
  into v_id,v_attempts,v_token;
  if v_id is null then return; end if;
  insert into public.document_scan_audit(document_id,event)
    values(v_id,'claimed');
  return query select v_id,v_attempts,v_token;
end $$;
revoke all on function public.claim_document_scan_job(integer) from public, anon, authenticated;
grant execute on function public.claim_document_scan_job(integer) to service_role;

-- Compare-and-set verdict: stale workers cannot override a newer claim.
create or replace function public.finish_document_scan_job(
  p_document_id uuid, p_lease_token uuid, p_verdict text,
  p_detail_code text default null)
returns boolean
language plpgsql security invoker set search_path=''
as $$
declare v_status text; v_event text;
begin
  if current_user <> 'service_role' then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_verdict not in ('clean','infected','retry','integrity_failed') then
    raise exception 'invalid verdict';
  end if;
  perform 1 from public.document_scan_jobs
    where document_id=p_document_id and state='processing'
      and lease_token=p_lease_token and lease_until>now()
    for update;
  if not found then return false; end if;
  v_status := case p_verdict when 'clean' then 'available'
    when 'infected' then 'rejected'
    when 'integrity_failed' then 'rejected'
    else 'quarantined' end;
  update public.document d set status=v_status
    where d.id=p_document_id and d.status in ('quarantined','scanning');
  if not found then return false; end if;
  update public.document_scan_jobs set
    state=case when p_verdict='clean' then 'completed'
      when p_verdict in ('infected','integrity_failed') then 'rejected'
      when attempts>=5 then 'dead' else 'pending' end,
    lease_token=null, lease_until=null,
    next_attempt_at=case when p_verdict='retry'
      then now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer))
      else next_attempt_at end,
    last_error_code=p_detail_code, updated_at=now()
    where document_id=p_document_id;
  v_event:=case when p_verdict='clean' then 'clean'
    when p_verdict='infected' then 'infected'
    when p_verdict='integrity_failed' then 'integrity_failed'
    when (select state from public.document_scan_jobs where document_id=p_document_id)='dead'
      then 'dead' else 'retry' end;
  insert into public.document_scan_audit(document_id,event,detail_code)
    values(p_document_id,v_event,left(p_detail_code,120));
  return true;
end $$;
revoke all on function public.finish_document_scan_job(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.finish_document_scan_job(uuid,uuid,text,text) to service_role;

-- Atomically queue and audit a fully stored, quarantined object.
-- Called only after the upload endpoint has completed Storage upload and
-- rechecked case permissions. Duplicate enqueues are rejected.
create or replace function public.enqueue_document_scan_job(p_document_id uuid)
returns boolean language plpgsql security invoker set search_path=''
as $$
declare v_document public.document%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select * into v_document from public.document where id=p_document_id for update;
  if not found or v_document.status <> 'quarantined'
    or v_document.storage_bucket <> 'case-documents'
    or v_document.storage_path is null then
    return false;
  end if;
  if not exists (
    select 1 from storage.objects o where o.bucket_id=v_document.storage_bucket
      and o.name=v_document.storage_path
  ) then return false; end if;
  insert into public.document_scan_jobs(document_id,state)
    values(p_document_id,'pending')
    on conflict (document_id) do nothing;
  if not found then return false; end if;
  insert into public.document_scan_audit(document_id,event)
    values(p_document_id,'queued');
  return true;
end $$;
revoke all on function public.enqueue_document_scan_job(uuid) from public,anon,authenticated;
grant execute on function public.enqueue_document_scan_job(uuid) to service_role;
