import { NextResponse } from "next/server";
import { z } from "zod";
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

  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const { data: document, error } = await supabase
    .from("document")
    .select("id, file_name, status, storage_bucket, storage_path")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (error || !document) {
    return NextResponse.json({ error: "Documento não encontrado ou sem acesso." }, { status: 404 });
  }

  if (
    document.status !== "available" ||
    document.storage_bucket !== "case-documents" ||
    !document.storage_path
  ) {
    return NextResponse.json(
      { error: "Documento ainda está em quarentena ou não está disponível para download." },
      { status: 423, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data: signed, error: signingError } = await supabase.storage
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

  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: {
      "Cache-Control": "no-store, private",
      "Referrer-Policy": "no-referrer"
    }
  });
}
