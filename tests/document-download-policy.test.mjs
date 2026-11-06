import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/features/documents/download-policy.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports });
const { canSignDocumentDownload } = exports;

const base = { status: "available", storage_bucket: "case-documents", storage_path: "case/document/original.pdf" };

test("only an available private-bucket document with an object key can be signed", () => {
  assert.equal(canSignDocumentDownload(base), true);
  for (const status of ["quarantined", "scanning", "rejected", "upload_failed", "pending", "uploaded", "infected", "", null]) {
    assert.equal(canSignDocumentDownload({ ...base, status }), false, String(status));
  }
  for (const bucket of ["public", "other", "", null]) {
    assert.equal(canSignDocumentDownload({ ...base, storage_bucket: bucket }), false, String(bucket));
  }
  for (const path of ["", "   ", "/absolute/file.pdf", "case/../other/file.pdf", "case/./file.pdf", "case//file.pdf", "case/file.pdf/", null, undefined]) {
    assert.equal(canSignDocumentDownload({ ...base, storage_path: path }), false, String(path));
  }
});
