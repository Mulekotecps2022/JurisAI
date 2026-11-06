import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export function createSupabaseAdminClient() {
  const env = getPublicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !secret) {
    throw new Error("A URL Supabase e a chave secreta do servidor são obrigatórias.");
  }

  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}
