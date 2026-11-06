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

  // Prevent accidental repeats for the same creator and identical details.
  // Names alone are not unique: different clients may legitimately share a name.
  const { data: existing, error: lookupError } = await supabase
    .from("tenentes")
    .select("id, email, phone, notes")
    .eq("created_by_user_id", user.id)
    .eq("name", parsed.data.name)
    .eq("kind", parsed.data.kind);

  if (lookupError) return errorResponse("Não foi possível verificar cadastros existentes. Tente novamente mais tarde.", 500);
  const normalized = (value: string | null | undefined) => (value ?? "").trim();
  const isDuplicate = (existing ?? []).some((person) =>
    normalized(person.email).toLowerCase() === normalized(parsed.data.email).toLowerCase() &&
    normalized(person.phone) === normalized(parsed.data.phone) &&
    normalized(person.notes) === normalized(parsed.data.notes)
  );
  if (isDuplicate) return errorResponse("Este cadastro já existe. Confira a lista antes de cadastrar novamente.", 409);

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
