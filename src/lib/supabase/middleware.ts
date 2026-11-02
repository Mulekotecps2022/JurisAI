import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSupabaseSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Permite builds e pré-visualizações sem credenciais; recursos privados
  // deverão exigir configuração válida antes de serem habilitados.
  if (!supabaseUrl || !publishableKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        if (headers) {
          Object.entries(headers).forEach(([name, value]) =>
            response.headers.set(name, value)
          );
        }
      }
    }
  });

  // Valida os claims e permite que o SDK renove a sessão quando necessário.
  // A autorização de dados continua obrigatoriamente no servidor e no RLS.
  await supabase.auth.getClaims();

  return response;
}
