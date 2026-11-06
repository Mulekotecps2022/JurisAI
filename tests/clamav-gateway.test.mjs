import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const base = "http://127.0.0.1:8788/scan";
const token = "ci-only-local-test-token-not-for-production-00001";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const eicar = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");

async function request(bytes, options = {}) {
  return fetch(base, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.token ?? token}`,
      "X-Content-SHA256": options.digest ?? sha(bytes),
      "Content-Type": "application/octet-stream"
    },
    body: bytes
  });
}

test("gateway rejects unauthorized requests", async () => {
  const response = await request(Buffer.from("hello"), { token: "wrong" });
  assert.equal(response.status, 401);
});

test("gateway rejects mismatched hash", async () => {
  const response = await request(Buffer.from("hello"), { digest: "0".repeat(64) });
  assert.equal(response.status, 422);
});

test("ClamAV marks harmless text clean and binds hash", async () => {
  const bytes = Buffer.from("JurisAI scanner integration test. No personal data.\n");
  const response = await request(bytes);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { verdict: "clean", sha256: sha(bytes) });
});

test("ClamAV detects EICAR test signature and binds hash", async () => {
  const response = await request(eicar);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { verdict: "infected", sha256: sha(eicar) });
});
