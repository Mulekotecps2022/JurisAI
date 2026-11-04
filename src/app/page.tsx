import Link from "next/link";

const modules = [
  { title: "Processos e casos", description: "Organização de casos, prazos e movimentações.", status: "Conectado ao Supabase", href: "/gestao" },
  { title: "Clientes e partes", description: "Cadastro estruturado de clientes e partes relacionadas.", status: "Conectado ao Supabase", href: "/gestao" },
  { title: "Documentos", description: "Biblioteca documental, classificação e acompanhamento da análise.", status: "Consulta protegida · upload suspenso", href: "/documentos" },
  { title: "Pesquisa jurídica", description: "Pesquisa com fontes oficiais e referências verificáveis.", status: "Planejado" },
  { title: "Assistente jurídico", description: "Apoio à análise, elaboração e revisão de documentos.", status: "Planejado" },
  { title: "Auditoria e segurança", description: "Permissões, histórico de ações e proteção de dados.", status: "Em validação" }
];

export default function Home() {
  return (
    <main className="min-h-screen px-5 py-8 md:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col gap-3 border-b border-slate-200 pb-7 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-juris-teal">Ambiente privado</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-juris-navy md:text-4xl">JurisAI</h1>
            <p className="mt-2 text-slate-600">Gestão e inteligência jurídica em um só lugar.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3"><span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">Estrutura em desenvolvimento</span><Link href="/login" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-juris-navy transition hover:bg-slate-50">Acessar conta</Link><Link href="/administracao" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-juris-navy transition hover:bg-slate-50">Área administrativa</Link></div>
        </header>

        <section className="mb-8 rounded-2xl bg-juris-navy p-6 text-white shadow-sm md:p-8">
          <p className="text-sm font-medium text-blue-200">Painel geral</p>
          <h2 className="mt-2 text-2xl font-semibold">Bem-vindo ao seu ambiente jurídico</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">A gestão de pessoas e processos já consulta e grava no Supabase sob políticas de acesso por usuário. A biblioteca documental consulta metadados protegidos; o envio de arquivos permanece suspenso até a integração de verificação antimalware.</p>
        </section>

        <section aria-labelledby="modules-title">
          <div className="mb-4">
            <h2 id="modules-title" className="text-xl font-semibold text-juris-navy">Módulos da plataforma</h2>
            <p className="mt-1 text-sm text-slate-500">Módulos conectados ou em validação progressiva.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => (
              <article key={module.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900">{module.title}</h3>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{module.description}</p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-juris-teal">{module.status}</p>
                  {"href" in module && module.href ? <Link href={module.href} className="text-sm font-semibold text-juris-navy hover:underline">Abrir módulo →</Link> : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-500">
          JurisAI · Acesso e dados jurídicos sujeitos a autenticação e controles de segurança.
        </footer>
      </div>
    </main>
  );
}
