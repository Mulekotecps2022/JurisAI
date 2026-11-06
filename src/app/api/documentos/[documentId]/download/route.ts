import { NextResponse } from "next/server";
import { z } from "zod";
import { canSignDocumentDownload } from "@/features/documents/download-policy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const documentIdSchema = z.string().uuid();
const SIGNED_URL_SECONDS = 300;

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const parsedId = documentIdSchema.safeParse(params.documentId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  // The user's session is the authorization boundary. The RLS-protected
  // metadata query must succeed before the privileged Storage client is used.
  let userClient: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    userClient = await createSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: "Serviço de autenticação indisponível." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const { data: document, error } = await userClient
    .from("document")
    .select("id, file_name, status, storage_bucket, storage_path")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (error || !document) {
    return NextResponse.json({ error: "Documento não encontrado ou sem acesso." }, { status: 404 });
  }

  if (!canSignDocumentDownload(document)) {
    return NextResponse.json(
      { error: "Documento ainda está em quarentena ou não está disponível para download." },
      { status: 423, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Storage intentionally has no browser policies. Only after the RLS query
  // above proves the user's access do we use the server-only secret to sign.
  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      { error: "O serviço de armazenamento ainda não foi configurado no servidor." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data: signed, error: signingError } = await admin.storage
    .from("case-documents")
    .createSignedUrl(document.storage_path, SIGNED_URL_SECONDS, {
      download: document.file_name
    });

  if (signingError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: "Não foi possível autorizar o download." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  // A signed URL already issued remains valid until expiry. Keep this window
  // short and never persist or expose it except through this redirect.
  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: {
      "Cache-Control": "no-store, private",
      "Referrer-Policy": "no-referrer"
    }
  });
}
