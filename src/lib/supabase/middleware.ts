import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isProtectedPath(pathname: string) {
  return pathname === "/gestao" ||
    pathname.startsWith("/gestao/") ||
    pathname === "/documentos" ||
    pathname.startsWith("/documentos/");
}

function redirectToLogin(request: NextRequest, response: NextResponse) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set(
    "next",
    request.nextUrl.pathname + request.nextUrl.search
  );

  const redirect = NextResponse.redirect(loginUrl);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function updateSupabaseSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const protectedPath = isProtectedPath(request.nextUrl.pathname);

  // Protected application modules fail closed when Auth is not configured.
  // Public pages (including the login page) remain available for setup.
  if (!supabaseUrl || !publishableKey) {
    if (protectedPath) {
      return redirectToLogin(request, NextResponse.next({ request }));
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: {
        name: string;
        value: string;
        options: CookieOptions;
      }[]) {
        // Update request cookies so Server Components see the refreshed session.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        // Recreate the response and attach the refreshed cookies.
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      }
    }
  });

  // Validates claims and allows the SDK to refresh the session when necessary.
  const { data, error } = await supabase.auth.getClaims();

  if (protectedPath && (error || !data?.claims)) {
    return redirectToLogin(request, response);
  }

  return response;
}
