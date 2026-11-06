import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

const scannerUrl = "http://127.0.0.1:8788/scan";
const scannerToken = "ci-only-local-test-token-not-for-production-00001";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const eicar = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");

// Isolated simulation of document state transitions. No production credentials,
// Supabase data, Storage objects, or user uploads are touched.
async function processQuarantinedDocument(bytes, options = {}) {
  const document = { id: randomUUID(), status: "quarantined", sha256: options.expectedHash ?? digest(bytes) };
  const history = ["quarantined"];
  const setStatus = status => { document.status = status; history.push(status); };
  setStatus("scanning");
  if (digest(bytes) !== document.sha256) {
    setStatus("rejected");
    return { document, history };
  }
  try {
    const response = await fetch(options.scannerUrl ?? scannerUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${scannerToken}`,
        "X-Content-SHA256": document.sha256,
        "Content-Type": "application/octet-stream"
      },
      body: bytes,
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error("scanner failed");
    const result = await response.json();
    if (result.sha256 !== document.sha256 || !["clean", "infected"].includes(result.verdict)) {
      throw new Error("unverifiable verdict");
    }
    setStatus(result.verdict === "clean" ? "available" : "rejected");
  } catch {
    setStatus("quarantined");
  }
  return { document, history };
}

test("quarantine -> scan -> available for clean document", async () => {
  const { document, history } = await processQuarantinedDocument(Buffer.from("JurisAI clean integration fixture"));
  assert.equal(document.status, "available");
  assert.deepEqual(history, ["quarantined", "scanning", "available"]);
});

test("quarantine -> scan -> rejected for EICAR", async () => {
  const { document, history } = await processQuarantinedDocument(eicar);
  assert.equal(document.status, "rejected");
  assert.deepEqual(history, ["quarantined", "scanning", "rejected"]);
});

test("quarantine -> rejected for integrity failure", async () => {
  const { document, history } = await processQuarantinedDocument(Buffer.from("changed"), { expectedHash: "0".repeat(64) });
  assert.equal(document.status, "rejected");
  assert.deepEqual(history, ["quarantined", "scanning", "rejected"]);
});

test("scanner unavailable -> quarantine (fail closed)", async () => {
  const { document, history } = await processQuarantinedDocument(Buffer.from("clean"), { scannerUrl: "http://127.0.0.1:1/scan" });
  assert.equal(document.status, "quarantined");
  assert.deepEqual(history, ["quarantined", "scanning", "quarantined"]);
});
