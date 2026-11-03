import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DOCUMENT_MAX_BYTES, allowedDocumentMimeTypes, buildDocumentObjectPath } from "@/features/documents/file-policy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "case-documents";
const caseIdSchema = z.string().uuid();

const extensionMimeMap: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  eml: "message/rfc822"
};

function hasValidSignature(bytes: Uint8Array, mime: string) {
  const starts = (...signature: number[]) =>
    signature.every((value, index) => bytes[index] === value);

  switch (mime) {
    case "application/pdf":
      return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/tiff":
      return starts(0x49, 0x49, 0x2a, 0x00) || starts(0x4d, 0x4d, 0x00, 0x2a);
    case "application/msword":
    case "application/vnd.ms-excel":
      return starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return starts(0x50, 0x4b, 0x03, 0x04);
    case "text/plain":
    case "message/rfc822":
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        return !text.includes("\u0000");
      } catch {
        return false;
      }
    default:
      return false;
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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

  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const expectedMime = extensionMimeMap[extension];
  if (
    !expectedMime ||
    file.type !== expectedMime ||
    !allowedDocumentMimeTypes.includes(file.type as (typeof allowedDocumentMimeTypes)[number])
  ) {
    return jsonError("A extensão e o tipo MIME do arquivo não são permitidos ou não correspondem.", 415);
  }

  const userClient = await createSupabaseServerClient();
  const { data: authData, error: authError } = await userClient.auth.getUser();
  const user = authData.user;
  if (authError || !user) {
    return jsonError("Autenticação necessária.", 401);
  }

  const { data: caseRecord, error: caseError } = await userClient
    .from("case")
    .select("id, owner_user_id")
    .eq("id", caseId)
    .maybeSingle();

  if (caseError || !caseRecord) {
    return jsonError("Processo não encontrado ou sem acesso.", 404);
  }

  let canUpload = caseRecord.owner_user_id === user.id;
  if (!canUpload) {
    const { data: access } = await userClient
      .from("case_access")
      .select("role")
      .eq("case_id", caseId)
      .eq("user_id", user.id)
      .maybeSingle();
    canUpload = access?.role === "editor";
  }

  if (!canUpload) {
    return jsonError("Somente o proprietário ou um editor pode anexar documentos.", 403);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidSignature(bytes, file.type)) {
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

  return NextResponse.json({
    documentId,
    status: "quarantined",
    message: "Arquivo recebido e isolado. Ele não poderá ser baixado até passar pela verificação de segurança."
  }, { status: 201 });
}
