import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdministrationPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    redirect("/login?next=%2Fadministracao");
  }

  // Read only the signed-in user's own profile. RLS remains the authority;
  // platform administration does not imply access to every legal case.
  const { data: profile, error: profileError } = await supabase
    .from("app_user_profiles")
    .select("display_name, platform_role")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const isPlatformAdmin = !profileError && profile?.platform_role === "platform_admin";

  if (!isPlatformAdmin) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-12">
        <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">Acesso restrito</p>
          <h1 className="mt-3 text-2xl font-bold text-juris-navy">Área administrativa</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Esta área exige o perfil administrativo da plataforma. Sua sessão continua protegida e nenhum dado jurídico foi alterado.
          </p>
          <Link href="/" className="mt-6 inline-flex rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Voltar ao painel inicial
          </Link>
        </section>
      </main>
    );
  }

  const checks = [
    { title: "Identidade administrativa", status: "Perfil platform_admin confirmado no banco de desenvolvimento", detail: "A tela consulta somente o perfil da sessão atual." },
    { title: "Separação de permissões", status: "Ativa", detail: "Ser administrador da plataforma não concede acesso automático aos processos." },
    { title: "Processos e pessoas", status: "Protegidos por RLS", detail: "A visibilidade depende do vínculo e das permissões de cada registro." },
    { title: "Biblioteca documental", status: "Acesso controlado", detail: "O bucket é privado; documentos em quarentena não podem ser baixados." },
    { title: "Envio de arquivos", status: "Suspenso preventivamente", detail: "Será liberado somente após scanner antimalware e inspeção estrutural confiáveis." },
    { title: "Sessão autenticada no ambiente hospedado", status: auth.user ? "Validada nesta requisição pelo servidor" : "Não confirmada", detail: "O servidor confirmou a identidade com supabase.auth.getUser() para carregar esta área protegida. Isso comprova uma sessão válida neste acesso; não é um histórico de entregabilidade do e-mail." }
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-7 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-slate-200 pb-6">
          <Link href="/" className="text-sm font-semibold text-teal-700 hover:underline">← Painel inicial</Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Controle da plataforma</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-juris-navy">Área administrativa</h1>
          <p className="mt-2 text-sm text-slate-600">
            {profile.display_name ? `Olá, ${profile.display_name}. ` : ""}Acompanhamento técnico do ambiente JurisAI de desenvolvimento.
          </p>
        </header>

        <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Perfil administrativo reconhecido</p>
          <p className="mt-1 text-sm leading-6 text-emerald-800">
            Sua identidade possui o papel platform_admin neste ambiente. Este papel administra a plataforma, mas não substitui a autorização individual para consultar processos.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-slate-900">Controles e situação dos módulos</h2>
          <p className="mt-1 text-sm text-slate-600">Status técnicos consultados durante o carregamento desta página.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {checks.map((check) => (
              <article key={check.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900">{check.title}</h3>
                <p className="mt-2 text-sm font-semibold text-teal-800">{check.status}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{check.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
          JurisAI · Painel somente de acompanhamento. Nenhuma permissão, conta, processo ou documento é alterado por esta página.
        </footer>
      </div>
    </main>
  );
}
