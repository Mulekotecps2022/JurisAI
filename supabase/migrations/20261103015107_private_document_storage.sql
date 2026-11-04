-- JurisAI private document storage.
-- REVIEW ONLY. Depends on the profile, case-access and legal-data RLS
-- migrations 20261103000100 through 20261103000300.
-- The application server uploads with a server-only secret after verifying
-- the user's identity and editor/owner access. Browser clients are read-only.
-- Files remain quarantined until an independent scanner marks them available.

begin;

alter table public.document
  add column if not exists created_by_user_id uuid
    references auth.users (id) on delete restrict,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists sha256 text,
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists status text not null default 'quarantined';

alter table public.document
  drop constraint if exists document_mime_type_check,
  add constraint document_mime_type_check check (
    mime_type is null or mime_type in (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'message/rfc822'
    )
  ),
  drop constraint if exists document_size_bytes_check,
  add constraint document_size_bytes_check check (
    size_bytes is null or size_bytes between 1 and 26214400
  ),
  drop constraint if exists document_sha256_check,
  add constraint document_sha256_check check (
    sha256 is null or sha256 ~ '^[0-9a-f]{64}$'
  ),
  drop constraint if exists document_storage_pair_check,
  add constraint document_storage_pair_check check (
    (storage_bucket is null and storage_path is null)
    or (storage_bucket = 'case-documents' and storage_path is not null)
  ),
  drop constraint if exists document_status_check,
  add constraint document_status_check check (
    status in ('quarantined', 'scanning', 'available', 'rejected', 'upload_failed')
  );

create unique index if not exists document_storage_object_unique
  on public.document (storage_bucket, storage_path)
  where storage_bucket is not null and storage_path is not null;
create index if not exists document_status_created_at_idx
  on public.document (status, created_at);

comment on column public.document.status is
  'Files default to quarantined. Only a trusted scanning workflow may mark a file available.';
comment on column public.document.sha256 is
  'SHA-256 calculated by the trusted upload server from the received bytes.';
comment on column public.document.storage_path is
  'Opaque object key; original filename is never used as a path component.';

-- Browser clients may read authorized metadata through RLS, but all writes
-- are performed by the trusted upload/scanning server workflow.
revoke all on table public.document from anon, authenticated;
grant select on table public.document to authenticated;

-- The bucket is private. If an identically named bucket already exists with
-- different security settings, abort instead of silently changing it.
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'case-documents',
  'case-documents',
  false,
  26214400,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'message/rfc822'
  ]::text[]
)
on conflict (id) do nothing;

do $$
declare
  bucket_is_private boolean;
  bucket_limit bigint;
  bucket_mimes text[];
begin
  select b.public, b.file_size_limit, b.allowed_mime_types
    into bucket_is_private, bucket_limit, bucket_mimes
  from storage.buckets as b
  where b.id = 'case-documents';

  if not found
    or bucket_is_private is distinct from false
    or bucket_limit is distinct from 26214400
    or bucket_mimes is distinct from array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'message/rfc822'
    ]::text[]
  then
    raise exception 'Bucket case-documents exists with unexpected or unsafe settings';
  end if;
end;
$$;

-- Supabase owns storage.objects; project migration role cannot alter its
-- ownership-controlled policies or grants. The table already has RLS enabled
-- by Supabase and no permissive client policies are created here. All object
-- writes and signed URL issuance use the trusted server-only secret after
-- checking public.document RLS and case access. Browser clients never receive
-- a storage secret. This fail-closed posture is intentionally restrictive.

commit;
