import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const zod = require("zod");
const source = readFileSync(new URL("../src/app/api/documentos/[documentId]/download/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const id = "11111111-1111-4111-8111-111111111111";
const base = { id, file_name: "document.pdf", status: "available", storage_bucket: "case-documents", storage_path: "case/document/original.pdf" };

async function invoke({ authenticated = true, document = base, queryError = null, queryThrows = false, signingThrows = false } = {}) {
  const calls = { admin: 0, signed: 0, queried: 0 };
  const userClient = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: "user-1" } : null }, error: null }) },
    from(table) {
      assert.equal(table, "document");
      calls.queried++;
      return {
        select() {
          return {
            eq(column, value) {
              assert.equal(column, "id");
              assert.equal(value, id);
              return {
                async maybeSingle() {
                  if (queryThrows) throw new Error("database unavailable");
                  return { data: document, error: queryError };
                }
              };
            }
          };
        }
      };
    }
  };
  const adminClient = {
    storage: {
      from(bucket) {
        assert.equal(bucket, "case-documents");
        return {
          async createSignedUrl(path, seconds) {
            calls.signed++;
            assert.equal(path, base.storage_path);
            assert.equal(seconds, 300);
            if (signingThrows) throw new Error("storage unavailable");
            return { data: { signedUrl: "https://storage.example.invalid/signed" }, error: null };
          }
        };
      }
    }
  };
  const exports = {};
  const mocks = {
    "next/server": { NextResponse: {
      json(body, init) { return Response.json(body, init); },
      redirect(url, init) { return Response.redirect(url, init?.status ?? 307); }
    } },
    zod,
    "@/features/documents/download-policy": {
      canSignDocumentDownload(d) {
        return d.status === "available" && d.storage_bucket === "case-documents" &&
          typeof d.storage_path === "string" && d.storage_path.length > 0;
      }
    },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => userClient },
    "@/lib/supabase/admin": { createSupabaseAdminClient() { calls.admin++; return adminClient; } }
  };
  vm.runInNewContext(compiled, { exports, require(name) {
    if (!(name in mocks)) throw new Error("Unexpected import: " + name);
    return mocks[name];
  }, Response, URL });
  const response = await exports.GET(new Request("https://app.example.invalid/api/documentos/" + id + "/download"), { params: Promise.resolve({ documentId: id }) });
  return { response, calls };
}

test("unauthenticated users never query documents or sign URLs", async () => {
  const { response, calls } = await invoke({ authenticated: false });
  assert.equal(response.status, 401);
  assert.equal(calls.queried, 0);
  assert.equal(calls.admin, 0);
  assert.equal(calls.signed, 0);
});

test("missing, inaccessible or failed metadata queries never sign URLs", async () => {
  for (const options of [{ document: null }, { queryError: { message: "RLS denied" } }, { queryThrows: true }]) {
    const { response, calls } = await invoke(options);
    assert.ok([404, 503].includes(response.status));
    assert.equal(calls.admin, 0);
    assert.equal(calls.signed, 0);
  }
});

test("quarantined and rejected documents never sign URLs", async () => {
  for (const status of ["quarantined", "scanning", "rejected", "infected", "pending", "uploaded"]) {
    const { response, calls } = await invoke({ document: { ...base, status } });
    assert.equal(response.status, 423, status);
    assert.equal(calls.admin, 0, status);
    assert.equal(calls.signed, 0, status);
  }
});

test("available document signs only after authorization; signing errors fail closed", async () => {
  const success = await invoke();
  assert.equal(success.response.status, 302);
  assert.equal(success.calls.queried, 1);
  assert.equal(success.calls.admin, 1);
  assert.equal(success.calls.signed, 1);
  const failure = await invoke({ signingThrows: true });
  assert.equal(failure.response.status, 503);
  assert.equal(failure.calls.signed, 1);
});
