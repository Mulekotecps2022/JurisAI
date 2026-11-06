import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { runOne } from "../services/document-scan-worker/worker.mjs";

const documentId = "11111111-1111-4111-8111-111111111111";
const leaseToken = "22222222-2222-4222-8222-222222222222";
const token = "isolated-http-worker-token-0123456789";
const claim = { document_id: documentId, lease_token: leaseToken };

async function withServer(handler, callback) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    return await callback(`http://127.0.0.1:${server.address().port}/internal/documents/scan`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

function queue(data = [claim]) {
  const calls = [];
  return {
    calls,
    async rpc(name, args) {
      calls.push({ name, args });
      return { data, error: null };
    }
  };
}

test("real HTTP: worker transmits authenticated lease and never sends service-role credentials", async () => {
  const received = [];
  await withServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received.push({ method: req.method, path: req.url, authorization: req.headers.authorization,
      type: req.headers["content-type"], body: JSON.parse(Buffer.concat(chunks).toString()) });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"message":"ok"}');
  }, async endpoint => {
    const db = queue();
    const result = await runOne({ supabase: db, endpoint, workerToken: token });
    assert.deepEqual(result, { status: "processed", httpStatus: 200 });
    assert.deepEqual(db.calls, [{ name: "claim_document_scan_job", args: { p_lease_seconds: 180 } }]);
  });
  assert.equal(received.length, 1);
  assert.equal(received[0].method, "POST");
  assert.equal(received[0].path, "/internal/documents/scan");
  assert.equal(received[0].authorization, `Bearer ${token}`);
  assert.equal(received[0].type, "application/json");
  assert.deepEqual(received[0].body, { documentId, leaseToken });
  assert.deepEqual(Object.keys(received[0].body).sort(), ["documentId", "leaseToken"]);
});

test("real HTTP: refused worker token fails closed and is deferred", async () => {
  await withServer((req, res) => {
    assert.equal(req.headers.authorization, `Bearer ${token}`);
    res.writeHead(401); res.end("unauthorized");
  }, async endpoint => {
    assert.deepEqual(await runOne({ supabase: queue(), endpoint, workerToken: token }),
      { status: "deferred", httpStatus: 401 });
  });
});

test("real HTTP: downstream scanner failure cannot be interpreted as success", async () => {
  await withServer((_req, res) => { res.writeHead(503); res.end("scanner unavailable"); }, async endpoint => {
    assert.deepEqual(await runOne({ supabase: queue(), endpoint, workerToken: token }),
      { status: "deferred", httpStatus: 503 });
  });
});

test("real HTTP: idle queue does not call scan endpoint", async () => {
  let requests = 0;
  await withServer((_req, res) => { requests++; res.end("unexpected"); }, async endpoint => {
    assert.deepEqual(await runOne({ supabase: queue([]), endpoint, workerToken: token }), { status: "idle" });
  });
  assert.equal(requests, 0);
});

test("worker rejects external plaintext HTTP before claiming jobs", async () => {
  const db = queue();
  await assert.rejects(runOne({ supabase: db, endpoint: "http://example.org/internal", workerToken: token }), /HTTPS required/);
  assert.equal(db.calls.length, 0);
});
