import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getCanonicalAppUrl(request: NextRequest) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) return new URL(configuredUrl);
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL is required in production.");
  }
  return new URL(request.url);
}

export async function GET(request: NextRequest) {
  let appUrl: URL;
  try {
    appUrl = getCanonicalAppUrl(request);
  } catch {
    return NextResponse.json({ error: "auth_configuration_missing" }, { status: 503 });
  }

  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const tokenType = request.nextUrl.searchParams.get("type");
  const requestedNext = request.nextUrl.searchParams.get("next") ?? "/";
  const candidateUrl = new URL(requestedNext, appUrl);
  const safeNextUrl =
    candidateUrl.origin === appUrl.origin
      ? candidateUrl
      : new URL("/", appUrl);

  // Existing PKCE links remain supported. Token-hash links can be verified
  // without requiring the initiating browser's PKCE code verifier.
  if (!code && (!tokenHash || tokenType !== "email")) {
    return NextResponse.redirect(new URL("/login?error=missing_code", appUrl));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: "email" });

    if (error) {
      return NextResponse.redirect(new URL("/login?error=invalid_code", appUrl));
    }

    return NextResponse.redirect(safeNextUrl);
  } catch {
    return NextResponse.redirect(new URL("/login?error=auth_unavailable", appUrl));
  }
}
