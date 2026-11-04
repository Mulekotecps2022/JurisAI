import { NextResponse } from "next/server";
import { personInputSchema } from "@/features/participants/domain";
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

  const { data, error } = await supabase
    .from("tenentes")
    .select("id, name, kind, email, phone, notes, created_at")
    .order("created_at", { ascending: false });

  if (error) return errorResponse("Não foi possível carregar os cadastros autorizados.", 500);

  return NextResponse.json({
    people: (data ?? []).map((person) => ({
      id: person.id,
      name: person.name,
      kind: person.kind,
      email: person.email ?? "",
      phone: person.phone ?? "",
      notes: person.notes ?? "",
      createdAt: person.created_at.slice(0, 10)
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

  const parsed = personInputSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Confira os dados informados.", 400);
  }

  const { data, error } = await supabase
    .from("tenentes")
    .insert({
      name: parsed.data.name,
      kind: parsed.data.kind,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
      created_by_user_id: user.id
    })
    .select("id, name, kind, email, phone, notes, created_at")
    .single();

  if (error) {
    if (error.code === "42501") return errorResponse("Você não tem permissão para criar este cadastro.", 403);
    return errorResponse("Não foi possível salvar o cadastro.", 500);
  }

  return NextResponse.json({
    person: {
      id: data.id,
      name: data.name,
      kind: data.kind,
      email: data.email ?? "",
      phone: data.phone ?? "",
      notes: data.notes ?? "",
      createdAt: data.created_at.slice(0, 10)
    }
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
