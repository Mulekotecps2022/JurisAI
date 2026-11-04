"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function authErrorMessage(code: string | null) {
  switch (code) {
    case "missing_code":
      return "O link de acesso chegou sem o código de confirmação. Solicite um novo link.";
    case "invalid_code":
      return "O link expirou ou já foi utilizado. Solicite um novo link e abra somente a mensagem mais recente.";
    case "auth_unavailable":
      return "Não foi possível concluir a autenticação agora. Tente novamente mais tarde.";
    default:
      return "";
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setError(authErrorMessage(params.get("error")));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const safeNext = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
        ? requestedNext
        : "/";
      const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
      const appOrigin = configuredAppUrl
        ? new URL(configuredAppUrl).origin
        : window.location.origin;

      if (process.env.NODE_ENV === "production" && !configuredAppUrl) {
        throw new Error("APP_URL_NOT_CONFIGURED");
      }

      const callbackUrl = new URL("/auth/confirm", appOrigin);
      callbackUrl.searchParams.set("next", safeNext);

      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: callbackUrl.toString()
        }
      });

      if (authError) {
        if (authError.message.toLowerCase().includes("rate limit")) {
          throw new Error("EMAIL_RATE_LIMIT");
        }
        throw new Error("EMAIL_REQUEST_FAILED");
      }

      setMessage("Se o endereço estiver cadastrado e autorizado, você receberá um link seguro de acesso.");
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "";
      if (reason === "EMAIL_RATE_LIMIT") {
        setError("O serviço de e-mail atingiu o limite temporário de envios. Aguarde antes de solicitar outro link.");
      } else if (reason === "APP_URL_NOT_CONFIGURED") {
        setError("O endereço seguro do aplicativo ainda não está configurado neste ambiente.");
      } else {
        setError("Não foi possível solicitar o acesso. Confira o endereço e tente novamente mais tarde.");
      }
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
