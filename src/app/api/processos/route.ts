import { NextResponse } from "next/server";
import { caseInputSchema } from "@/features/cases/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function getAuthenticatedClient() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase: null, user: null };
  return { supabase, user: data.user };
}

export async function GET() {
  const { supabase } = await getAuthenticatedClient();
  if (!supabase) return errorResponse("Autenticação necessária.", 401);

  const { data: cases, error } = await supabase
    .from("case")
    .select("id, title, description, created_at")
    .order("created_at", { ascending: false });

  if (error) return errorResponse("Não foi possível carregar os processos autorizados.", 500);
  if (!cases?.length) return NextResponse.json({ cases: [] }, { headers: { "Cache-Control": "no-store" } });

  const caseIds = cases.map((item) => item.id);
  const { data: participants, error: participantError } = await supabase
    .from("case_participants")
    .select("id, case_id, tenente_id, role, notes")
    .in("case_id", caseIds);

  if (participantError) return errorResponse("Não foi possível carregar os participantes autorizados.", 500);

  const personIds = [...new Set((participants ?? []).map((item) => item.tenente_id))];
  const { data: people, error: peopleError } = personIds.length
    ? await supabase.from("tenentes").select("id, name").in("id", personIds)
    : { data: [], error: null };

  if (peopleError) return errorResponse("Não foi possível carregar os nomes dos participantes autorizados.", 500);

  const names = new Map((people ?? []).map((person) => [person.id, person.name]));
  const grouped = new Map<string, Array<{ personId: string; personName: string; role: string; notes: string }>>();

  for (const participant of participants ?? []) {
    const list = grouped.get(participant.case_id) ?? [];
    list.push({
      personId: participant.tenente_id,
      personName: names.get(participant.tenente_id) ?? "Cadastro não disponível",
      role: participant.role,
      notes: participant.notes ?? ""
    });
    grouped.set(participant.case_id, list);
  }

  return NextResponse.json({
    cases: cases.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      participants: grouped.get(item.id) ?? [],
      createdAt: item.created_at.slice(0, 10)
    }))
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthenticatedClient();
  if (!supabase || !user) return errorResponse("Autenticação necessária.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Corpo JSON inválido.", 400);
  }

  const parsed = caseInputSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Confira os dados informados.", 400);
  }

  const { data: item, error } = await supabase
    .from("case")
    .insert({
      owner_user_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description || null
    })
    .select("id, title, description, created_at")
    .single();

  if (error || !item) {
    if (error?.code === "42501") return errorResponse("Não foi possível criar o processo com estas permissões.", 403);
    return errorResponse("Não foi possível criar o processo.", 500);
  }

  let participantWarning: string | null = null;
  if (parsed.data.participants.length) {
    const { error: participantsError } = await supabase
      .from("case_participants")
      .insert(parsed.data.participants.map((participant) => ({
        case_id: item.id,
        tenente_id: participant.personId,
        role: participant.role,
        notes: participant.notes || null
      })));

    if (participantsError) {
      participantWarning = "O processo foi criado, mas um ou mais participantes não puderam ser vinculados. Confira o acesso aos cadastros.";
    }
  }

  return NextResponse.json({
    case: {
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      participants: participantWarning ? [] : parsed.data.participants.map((participant) => ({
        personId: participant.personId,
        role: participant.role
      })),
      createdAt: item.created_at.slice(0, 10)
    },
    warning: participantWarning
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
