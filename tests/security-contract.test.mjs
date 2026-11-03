import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("security migrations are ordered and storage depends on legal-data RLS", async () => {
  const files = [
    "../supabase/migrations/20261103000100_app_user_profiles.sql",
    "../supabase/migrations/20261103000200_case_ownership_and_access.sql",
    "../supabase/migrations/20261103000300_legal_data_rls_cutover.sql",
    "../supabase/migrations/20261103000400_private_document_storage.sql"
  ];
  const contents = await Promise.all(files.map(read));
  assert.match(contents[0], /platform_role.*platform_admin/s);
  assert.match(contents[1], /create table if not exists public\.case_access/);
  assert.match(contents[2], /alter table public\.case enable row level security/);
  assert.match(contents[2], /alter table public\.embedding enable row level security/);
  assert.match(contents[3], /references auth\.users/);
});

test("private bucket and fail-closed Storage integration are explicit", async () => {
  const sql = await read("../supabase/migrations/20261103000400_private_document_storage.sql");
  assert.match(sql, /'case-documents',[\s\S]*?false,[\s\S]*?26214400/);
  assert.match(sql, /'quarantined',[\\s\\S]*?'available'/);
  assert.match(sql, /Supabase owns storage\.objects/i);
  assert.match(sql, /no permissive client policies are created here/i);
  assert.match(sql, /revoke all on table public\.document from anon, authenticated/i);
  assert.match(sql, /grant select on table public\.document to authenticated/i);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete).*storage\.objects/i);
});

test("upload route authenticates, authorizes editor/owner and quarantines", async () => {
  const route = await read("../src/app/api/documentos/upload/route.ts");
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /owner_user_id === userId/);
  assert.match(route, /access\?\.role === "editor"/);
  assert.match(route, /DOCUMENT_MAX_BYTES/);
  assert.match(route, /hasAllowedDocumentSignature/);
  assert.match(route, /createHash\("sha256"\)/);
  assert.match(route, /status: "quarantined"/);
  assert.match(route, /createSupabaseAdminClient/);
  assert.match(route, /Re-check after the privileged object write/);
});

test("download route fails closed unless scanner status is available", async () => {
  const route = await read("../src/app/api/documentos/[documentId]/download/route.ts");
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /document\.status !== "available"/);
  assert.match(route, /SIGNED_URL_SECONDS = 300/);
  assert.match(route, /createSignedUrl/);
  assert.match(route, /Cache-Control.*no-store/);
});

test("admin Supabase key is server-only and not exposed as NEXT_PUBLIC", async () => {
  const admin = await read("../src/lib/supabase/admin.ts");
  const envExample = await read("../.env.example");
  assert.match(admin, /import "server-only"/);
  assert.match(admin, /SUPABASE_SECRET_KEY/);
  assert.match(admin, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_SUPABASE_(SECRET|SERVICE_ROLE)_KEY/);
  assert.match(envExample, /^SUPABASE_SECRET_KEY=$/m);
});
