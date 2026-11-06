-- Draft migration: apply to development only after review.
-- Jobs and append-only audit events. No client grants, no browser access.
create table if not exists public.document_scan_jobs (
  document_id uuid primary key references public.document(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','processing','completed','rejected','dead')),
  attempts integer not null default 0 check (attempts >= 0),
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

-- Atomic claim, bounded retries, and expired lease recovery.
create or replace function public.claim_document_scan_job(p_lease_seconds integer default 180)
returns table(document_id uuid, attempts integer)
language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_attempts integer;
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
  if p_lease_seconds < 30 or p_lease_seconds > 600 then raise exception 'invalid lease'; end if;
  update public.document_scan_jobs j set
    state='pending', lease_until=null, next_attempt_at=now(), updated_at=now()
  where j.state='processing' and j.lease_until < now() and j.attempts < 5;
  update public.document_scan_jobs j set
    state='dead', lease_until=null, updated_at=now(), last_error_code='LEASE_EXHAUSTED'
  where j.state='processing' and j.lease_until < now() and j.attempts >= 5;
  select j.document_id into v_id from public.document_scan_jobs j
    where j.state='pending' and j.next_attempt_at <= now() and j.attempts < 5
    order by j.next_attempt_at, j.created_at for update skip locked limit 1;
  if v_id is null then return; end if;
  update public.document_scan_jobs j set state='processing',
    attempts=j.attempts+1, lease_until=now()+make_interval(secs=>p_lease_seconds),
    updated_at=now() where j.document_id=v_id returning j.attempts into v_attempts;
  insert into public.document_scan_audit(document_id,event)
    values(v_id,'claimed');
  return query select v_id,v_attempts;
end $$;
revoke all on function public.claim_document_scan_job(integer) from public, anon, authenticated;
grant execute on function public.claim_document_scan_job(integer) to service_role;
