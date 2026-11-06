import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return errorResponse("Serviço de autenticação indisponível.", 503);
  }
  let authData: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"];
  let authError: Awaited<ReturnType<typeof supabase.auth.getUser>>["error"];
  try {
    ({ data: authData, error: authError } = await supabase.auth.getUser());
  } catch {
    return errorResponse("Serviço de autenticação indisponível.", 503);
  }
  if (authError || !authData.user) return errorResponse("Autenticação necessária.", 401);

  const { data: documents, error } = await supabase
    .from("document")
    .select("id, case_id, file_name, created_at, mime_type, size_bytes, status")
    .order("created_at", { ascending: false });

  if (error) return errorResponse("Não foi possível carregar os documentos autorizados.", 500);
  if (!documents?.length) {
    return NextResponse.json({ documents: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const caseIds = [...new Set(documents.map((document) => document.case_id))];
  const { data: cases, error: casesError } = await supabase
    .from("case")
    .select("id, title")
    .in("id", caseIds);

  if (casesError) return errorResponse("Não foi possível carregar os processos relacionados.", 500);

  const caseTitles = new Map((cases ?? []).map((item) => [item.id, item.title]));

  return NextResponse.json({
    documents: documents.map((document) => ({
      id: document.id,
      caseId: document.case_id,
      caseTitle: caseTitles.get(document.case_id) ?? "Processo não disponível",
      title: document.file_name,
      fileName: document.file_name,
      createdAt: document.created_at.slice(0, 10),
      mimeType: document.mime_type,
      sizeBytes: document.size_bytes,
      status: document.status
    }))
  }, { headers: { "Cache-Control": "no-store" } });
}
