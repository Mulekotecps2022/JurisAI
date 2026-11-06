// Draft queue consumer. Run only as a private, authenticated worker.
// Never expose the service-role key or worker token to a browser.
import { setTimeout as sleep } from "node:timers/promises";

export async function runOne({ supabase, endpoint, workerToken, fetchImpl = fetch }) {
  if (!supabase || !endpoint || !workerToken || workerToken.length < 32) {
    throw new Error("Worker not configured");
  }
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV === "test" && url.hostname === "127.0.0.1")) {
    throw new Error("HTTPS required");
  }
  const { data: rows, error } = await supabase.rpc("claim_document_scan_job", { p_lease_seconds: 180 });
  if (error) throw new Error("Queue claim failed");
  const job = rows?.[0];
  if (!job) return { status: "idle" };
  if (!job.document_id || !job.lease_token) throw new Error("Invalid queue claim");
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${workerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: job.document_id, leaseToken: job.lease_token }),
      signal: AbortSignal.timeout(110000),
      cache: "no-store"
    });
    return { status: response.ok ? "processed" : "deferred", httpStatus: response.status };
  } catch {
    // The DB lease will expire and be recovered by the next claim.
    // Never grant access to the document on network failure.
    return { status: "deferred" };
  }
}

export async function runLoop(config, { intervalMs = 5000, signal } = {}) {
  while (!signal?.aborted) {
    await runOne(config);
    await sleep(intervalMs, undefined, { signal }).catch(() => {});
  }
}
