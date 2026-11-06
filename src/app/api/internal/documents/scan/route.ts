import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 120;

const BUCKET = "case-documents";
const MAX_BYTES = 25 * 1024 * 1024;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function authorized(request: Request, secret: string) {
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function reply(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Internal-only worker endpoint. The caller must authenticate with a separate
 * worker token. No browser, user JWT, or user-supplied Storage path is trusted.
 *
 * Scanner contract: POST binary bytes with Authorization: Bearer <scanner token>.
 * Response must be HTTP 200 JSON { verdict: "clean" | "infected", sha256: "<hex>" }.
 * The scanner MUST hash the exact bytes it inspected. Any ambiguity fails closed.
 */
export async function POST(request: Request) {
  const workerSecret = process.env.JURISAI_SCAN_WORKER_TOKEN;
  const scannerUrl = process.env.JURISAI_SCANNER_URL;
  const scannerSecret = process.env.JURISAI_SCANNER_TOKEN;
  if (!workerSecret || workerSecret.length < 32 || !scannerUrl || !scannerSecret) {
    return reply("Serviço de verificação não configurado.", 503);
  }
  if (!authorized(request, workerSecret)) return reply("Não autorizado.", 401);

  let endpoint: URL;
  try {
    endpoint = new URL(scannerUrl);
    if (endpoint.protocol !== "https:") throw new Error("HTTPS obrigatório");
  } catch {
    return reply("Endpoint de verificação inválido.", 503);
  }

  let documentId: unknown;
  let leaseToken: unknown;
  try {
    const payload = await request.json();
    documentId = payload.documentId;
    leaseToken = payload.leaseToken;
  } catch {
    return reply("Requisição inválida.", 400);
  }
  if (typeof documentId !== "string" || !ID_PATTERN.test(documentId) ||
      typeof leaseToken !== "string" || !ID_PATTERN.test(leaseToken)) {
    return reply("Identificador inválido.", 400);
  }

  const admin = createSupabaseAdminClient();
  // The worker must first claim the queue job through claim_document_scan_job.
  // Never scan arbitrary quarantined documents without a valid active lease.
  const { data: job, error: jobError } = await admin.from("document_scan_jobs")
    .select("document_id").eq("document_id", documentId)
    .eq("lease_token", leaseToken).eq("state", "processing")
    .gt("lease_until", new Date().toISOString()).maybeSingle();
  if (jobError) return reply("Fila indisponível.", 503);
  if (!job) return reply("Reserva inválida ou expirada.", 409);

  const { data: claimed, error: claimError } = await admin.from("document")
    .select("id, case_id, storage_bucket, storage_path, sha256, size_bytes, mime_type, status")
    .eq("id", documentId).in("status", ["quarantined", "scanning"]).maybeSingle();
  if (claimError) return reply("Falha ao consultar documento.", 500);
  if (!claimed) return reply("Documento indisponível para verificação.", 409);

  const finish = async (verdict: "clean" | "infected" | "retry" | "integrity_failed", detail?: string) => {
    const { data, error } = await admin.rpc("finish_document_scan_job", {
      p_document_id: documentId, p_lease_token: leaseToken,
      p_verdict: verdict, p_detail_code: detail ?? null
    });
    return !error && data === true;
  };

  try {
    if (claimed.storage_bucket !== BUCKET || !claimed.storage_path ||
        !claimed.storage_path.startsWith(`${claimed.case_id}/`) ||
        !claimed.sha256 || !claimed.size_bytes || claimed.size_bytes > MAX_BYTES) {
      if (!await finish("integrity_failed", "METADATA_INVALID")) return reply("Reserva expirada.", 409);
      return reply("Metadados do arquivo inconsistentes.", 422);
    }

    const { data: file, error: fileError } = await admin.storage.from(BUCKET).download(claimed.storage_path);
    if (fileError || !file) throw new Error("Arquivo indisponível");
    const bytes = Buffer.from(await file.arrayBuffer());
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (bytes.length !== claimed.size_bytes || digest !== claimed.sha256) {
      if (!await finish("integrity_failed", "HASH_MISMATCH")) return reply("Reserva expirada.", 409);
      return reply("Integridade do arquivo inválida.", 422);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${scannerSecret}`,
          "Content-Type": claimed.mime_type || "application/octet-stream",
          "X-Content-SHA256": digest
        },
        body: bytes,
        cache: "no-store",
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error("Scanner indisponível");
    const verdict: unknown = await response.json();
    if (!verdict || typeof verdict !== "object") throw new Error("Resposta inválida");
    const result = verdict as { verdict?: unknown; sha256?: unknown };
    if (result.sha256 !== digest || !["clean", "infected"].includes(String(result.verdict))) {
      throw new Error("Resultado do scanner não verificável");
    }
    if (!await finish(result.verdict as "clean" | "infected")) {
      return reply("Reserva expirada; resultado descartado.", 409);
    }
    return reply(result.verdict === "clean" ? "Verificação concluída." : "Arquivo rejeitado.", 200);
  } catch {
    await finish("retry", "SCAN_INCONCLUSIVE");
    return reply("Verificação inconclusiva; arquivo permanece bloqueado.", 503);
  }
}
