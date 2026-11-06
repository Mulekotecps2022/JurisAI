import test from "node:test";
import assert from "node:assert/strict";
import { runOne } from "../services/document-scan-worker/worker.mjs";

const id = "11111111-1111-4111-8111-111111111111";
const lease = "22222222-2222-4222-8222-222222222222";
const endpoint = "https://scanner.invalid/internal";
const workerToken = "isolated-ci-token-0123456789-abcdefgh";
function queue() {
  let state = "pending", attempts = 0, token = null, expiry = 0;
  const audit = [];
  return {
    audit,
    async rpc(name, args) {
      if (name !== "claim_document_scan_job") throw Error("unexpected RPC");
      if (state === "processing" && expiry <= Date.now()) {
        state = attempts >= 5 ? "dead" : "pending";
        token = null;
        audit.push(attempts >= 5 ? "dead" : "recovered");
      }
      if (state !== "pending") return { data: [], error: null };
      state = "processing"; attempts++; token = attempts === 1 ? lease : "33333333-3333-4333-8333-333333333333"; expiry = Date.now() + args.p_lease_seconds * 1000;
      audit.push("claimed");
      return { data: [{ document_id: id, lease_token: token }], error: null };
    },
    expire() { expiry = 0; },
    finish(t, verdict) {
      if (state !== "processing" || token !== t || expiry <= Date.now()) return false;
      state = verdict === "retry" ? "pending" : verdict === "clean" ? "completed" : "rejected";
      audit.push(verdict);
      token = null;
      return true;
    },
    get state() { return state; },
    get attempts() { return attempts; }
  };
}
const config = supabase => ({ supabase, endpoint, workerToken });

test("concurrent workers cannot claim the same document twice", async () => {
  const db = queue();
  const results = await Promise.all(Array.from({ length: 8 }, () => runOne({
    ...config(db), fetchImpl: async () => ({ ok: true, status: 200 })
  })));
  assert.equal(results.filter(r => r.status === "processed").length, 1);
  assert.equal(db.attempts, 1);
  assert.deepEqual(db.audit, ["claimed"]);
});

test("expired lease recovers; stale verdict is refused", async () => {
  const db = queue();
  await runOne({ ...config(db), fetchImpl: async () => ({ ok: true, status: 200 }) });
  db.expire();
  await runOne({ ...config(db), fetchImpl: async () => ({ ok: true, status: 200 }) });
  assert.equal(db.attempts, 2);
  assert.equal(db.finish(lease, "clean"), false);
  assert.equal(db.finish("incorrect-token", "clean"), false);
  assert.deepEqual(db.audit, ["claimed", "recovered", "claimed"]);
});

test("network error never approves document", async () => {
  const db = queue();
  const result = await runOne({ ...config(db), fetchImpl: async () => { throw Error("offline"); } });
  assert.equal(result.status, "deferred");
  assert.equal(db.state, "processing");
});

test("audited clean, infected and retry decisions are guarded by lease", async () => {
  const db = queue();
  await runOne({ ...config(db), fetchImpl: async () => ({ ok: true, status: 200 }) });
  assert.equal(db.finish(lease, "retry"), true);
  assert.equal(db.finish(lease, "clean"), false);
  await runOne({ ...config(db), fetchImpl: async () => ({ ok: true, status: 200 }) });
  assert.equal(db.finish("33333333-3333-4333-8333-333333333333", "infected"), true);
  assert.equal(db.state, "rejected");
  assert.deepEqual(db.audit, ["claimed", "retry", "claimed", "infected"]);
});
