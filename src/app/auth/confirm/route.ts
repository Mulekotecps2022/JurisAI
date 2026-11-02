import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next") ?? "/";
  const candidateUrl = new URL(requestedNext, request.url);
  const safeNextUrl =
    candidateUrl.origin === request.nextUrl.origin
      ? candidateUrl
      : new URL("/", request.url);

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL("/login?error=invalid_code", request.url));
    }

    return NextResponse.redirect(safeNextUrl);
  } catch {
    return NextResponse.redirect(new URL("/login?error=auth_unavailable", request.url));
  }
}
