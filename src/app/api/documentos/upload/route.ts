import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  DOCUMENT_MAX_BYTES,
  documentExtensionMimeMap,
  getDocumentExtension,
  hasAllowedDocumentSignature,
  buildDocumentObjectPath
} from "@/features/documents/file-policy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "case-documents";
const caseIdSchema = z.string().uuid();

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function canUploadToCase(
  userClient: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  caseId: string,
  userId: string
) {
  const { data: caseRecord, error: caseError } = await userClient
    .from("case")
    .select("id, owner_user_id")
    .eq("id", caseId)
    .maybeSingle();

  if (caseError || !caseRecord) return false;
  if (caseRecord.owner_user_id === userId) return true;

  const { data: access, error: accessError } = await userClient
    .from("case_access")
    .select("role")
    .eq("case_id", caseId)
    .eq("user_id", userId)
    .maybeSingle();

  return !accessError && access?.role === "editor";
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > DOCUMENT_MAX_BYTES + 256 * 1024) {
    return jsonError("O arquivo excede o limite de 25 MiB.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Envie um formulário multipart válido.", 400);
  }

  const caseIdResult = caseIdSchema.safeParse(form.get("caseId"));
  const file = form.get("file");
  if (!caseIdResult.success || !(file instanceof File)) {
    return jsonError("Informe um processo válido e selecione um arquivo.", 400);
  }

  const caseId = caseIdResult.data;
  if (file.size <= 0 || file.size > DOCUMENT_MAX_BYTES) {
    return jsonError("O arquivo deve ter entre 1 byte e 25 MiB.", 413);
  }

  const fileName = file.name.trim();
  if (!fileName || fileName.length > 255) {
    return jsonError("Nome de arquivo inválido.", 400);
  }

  const extension = getDocumentExtension(fileName);
  const expectedMime = documentExtensionMimeMap[extension];
  if (!expectedMime || file.type !== expectedMime) {
    return jsonError("A extensão e o tipo MIME do arquivo não são permitidos ou não correspondem.", 415);
  }

  const userClient = await createSupabaseServerClient();
  const { data: authData, error: authError } = await userClient.auth.getUser();
  const user = authData.user;
  if (authError || !user) {
    return jsonError("Autenticação necessária.", 401);
  }

  if (!(await canUploadToCase(userClient, caseId, user.id))) {
    return jsonError("Processo não encontrado ou você não tem permissão para anexar documentos.", 403);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasAllowedDocumentSignature(bytes, file.type)) {
    return jsonError("O conteúdo não corresponde a um formato de arquivo aceito.", 415);
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const documentId = crypto.randomUUID();
  let storagePath: string;
  try {
    storagePath = buildDocumentObjectPath({ caseId, documentId, extension });
  } catch {
    return jsonError("Não foi possível gerar um caminho seguro para o arquivo.", 400);
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return jsonError("O serviço de armazenamento ainda não foi configurado no servidor.", 503);
  }

  const { error: metadataError } = await admin.from("document").insert({
    id: documentId,
    case_id: caseId,
    file_name: fileName,
    created_by_user_id: user.id,
    mime_type: file.type,
    size_bytes: file.size,
    sha256,
    storage_bucket: BUCKET,
    storage_path: storagePath,
    status: "quarantined"
  });

  if (metadataError) {
    return jsonError("Não foi possível registrar o documento com segurança.", 500);
  }

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      cacheControl: "0",
      upsert: false
    });

  if (uploadError) {
    await admin.from("document").update({ status: "upload_failed" }).eq("id", documentId);
    return jsonError("O registro foi criado, mas o armazenamento falhou. O item foi marcado para revisão.", 502);
  }

  // Re-check after the privileged object write to narrow the revocation race.
  // If access was revoked during upload, delete the object and keep it blocked.
  if (!(await canUploadToCase(userClient, caseId, user.id))) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    await admin.from("document").update({ status: "rejected" }).eq("id", documentId);
    return jsonError("O acesso ao processo foi revogado durante o envio. O arquivo foi bloqueado.", 403);
  }

  return NextResponse.json({
    documentId,
    status: "quarantined",
    message: "Arquivo recebido e isolado. Ele não poderá ser baixado até passar pela verificação de segurança."
  }, { status: 201 });
}
