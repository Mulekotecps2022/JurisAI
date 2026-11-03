-- Structural checks for private document storage.
-- Run only after migrations 001-004 in an isolated Supabase environment.

do $$
declare
  is_public boolean;
  max_bytes bigint;
  mime_types text[];
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'objects'
      and c.relrowsecurity
  ) then
    raise exception 'storage.objects must have RLS enabled';
  end if;

  select public, file_size_limit, allowed_mime_types
    into is_public, max_bytes, mime_types
  from storage.buckets
  where id = 'case-documents';

  if not found or is_public is distinct from false then
    raise exception 'case-documents bucket must exist and be private';
  end if;

  if max_bytes is distinct from 26214400 then
    raise exception 'case-documents must enforce a 25 MiB limit';
  end if;

  if not ('application/pdf' = any(mime_types))
     or not ('image/png' = any(mime_types))
     or 'image/svg+xml' = any(mime_types) then
    raise exception 'case-documents MIME allowlist is incorrect';
  end if;

  if has_table_privilege('anon','storage.objects','SELECT')
     or has_table_privilege('anon','storage.objects','INSERT')
     or has_table_privilege('authenticated','storage.objects','INSERT')
     or has_table_privilege('authenticated','storage.objects','UPDATE')
     or has_table_privilege('authenticated','storage.objects','DELETE') then
    raise exception 'browser roles have unexpected Storage privileges';
  end if;

  if has_table_privilege('authenticated','public.document','INSERT')
     or has_table_privilege('authenticated','public.document','UPDATE')
     or has_table_privilege('authenticated','public.document','DELETE') then
    raise exception 'browser role can mutate document metadata';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'case_documents_read_available'
      and cmd = 'SELECT'
  ) then
    raise exception 'Missing authorized available-document read policy';
  end if;
end;
$$;

-- Required behavioral tests with owner, editor, viewer, unrelated user and anon:
-- 1. Browser clients cannot upload, replace, move, or delete Storage objects.
-- 2. The authenticated server endpoint rejects anon, viewer, unknown case,
--    mismatched MIME/extension, invalid signatures, empty and >25 MiB files.
-- 3. Owner/editor upload creates a quarantined object; no client can download
--    or create a signed URL while status is quarantined.
-- 4. A scanner-only service workflow may transition quarantined -> scanning
--    -> available after malware/content checks. Rejected files never become
--    readable and their object is removed through an audited server action.
-- 5. Available file is readable only to owner/editor/viewer of its case.
-- 6. Revocation removes the ability to create new signed URLs.
-- 7. UUID/path tampering, another case's document ID, and forged metadata fail.
-- 8. Signed URLs are short-lived (target 5 minutes) and are never persisted.
