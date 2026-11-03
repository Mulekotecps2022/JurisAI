"use client";

import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/confirm`
        }
      });

      if (authError) throw authError;
      setMessage("Se o endereço estiver cadastrado e autorizado, você receberá um link de acesso por e-mail.");
    } catch {
      setError("Não foi possível solicitar o acesso. Confira a configuração e tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-juris-teal">Ambiente privado</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-juris-navy">Acessar o JurisAI</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Informe o e-mail previamente cadastrado para receber um link seguro de acesso.
        </p>

        <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-juris-teal focus:ring-2 focus:ring-teal-100"
              placeholder="voce@exemplo.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full rounded-lg bg-juris-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Enviar link de acesso"}
          </button>
        </form>

        {message && (
          <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
          O cadastro público está desativado no fluxo da aplicação. Contas precisam ser provisionadas pelo administrador do projeto.
        </p>
      </section>
    </main>
  );
}
