import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inputSchema = z.object({ archived: z.boolean() }).strict();
const uuidSchema = z.string().uuid();

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  if (!uuidSchema.safeParse(caseId).success) return fail("Identificador do processo inválido.", 400);
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return fail("Autenticação necessária.", 401);

  let body: unknown;
  try { body = await request.json(); } catch { return fail("Corpo JSON inválido.", 400); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return fail("Informe se o processo deve ser arquivado ou restaurado.", 400);

  // The ownership filter supplements the database's RLS and column-level UPDATE grant.
  // Only archived_at changes; no document, participant, or case row is deleted.
  const { data, error } = await supabase
    .from("case")
    .update({ archived_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq("id", caseId)
    .eq("owner_user_id", auth.user.id)
    .select("id, archived_at")
    .maybeSingle();

  if (error?.code === "42501") return fail("Apenas o proprietário pode alterar o arquivamento.", 403);
  if (error) return fail("Não foi possível atualizar o arquivamento.", 500);
  if (!data) return fail("Processo não encontrado ou sem permissão.", 404);

  return NextResponse.json({ id: data.id, archivedAt: data.archived_at }, { headers: { "Cache-Control": "no-store" } });
}
