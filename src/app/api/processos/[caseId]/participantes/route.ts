import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { caseParticipantInputSchema } from "@/features/participants/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const caseIdSchema = z.string().uuid();

export async function POST(request: NextRequest, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  if (!caseIdSchema.safeParse(caseId).success) {
    return NextResponse.json({ error: "Processo inválido." }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });

  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  const parsed = caseParticipantInputSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });

  const { data: legalCase, error: caseError } = await supabase
    .from("case").select("id, archived_at").eq("id", caseId).eq("owner_user_id", auth.user.id).maybeSingle();
  if (caseError || !legalCase) return NextResponse.json({ error: "Processo não disponível para vinculação." }, { status: 403 });
  if (legalCase.archived_at) return NextResponse.json({ error: "Restaure o processo antes de vincular pessoas." }, { status: 409 });

  const { data: person } = await supabase
    .from("tenentes").select("id").eq("id", parsed.data.personId).eq("created_by_user_id", auth.user.id).maybeSingle();
  if (!person) return NextResponse.json({ error: "Pessoa não disponível para vinculação." }, { status: 403 });

  const { error } = await supabase.from("case_participants").insert({
    case_id: caseId, tenente_id: person.id, role: parsed.data.role,
    notes: parsed.data.notes || null
  });
  if (error?.code === "23505") return NextResponse.json({ error: "Esta pessoa já está vinculada ao processo nesse papel." }, { status: 409 });
  if (error) return NextResponse.json({ error: "Não foi possível vincular a pessoa." }, { status: 500 });
  return NextResponse.json({ participant: { personId: person.id, role: parsed.data.role } }, { status: 201 });
}
