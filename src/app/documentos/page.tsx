"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CaseOption = { id: string; title: string };
type StorageStatus = "quarantined" | "scanning" | "available" | "rejected" | "upload_failed";
type DocumentRecord = {
  id: string;
  title: string;
  fileName: string;
  caseId: string;
  caseTitle: string;
  createdAt: string;
  mimeType: string | null;
  sizeBytes: number | null;
  status: StorageStatus;
};

const statusLabels: Record<StorageStatus, string> = {
  quarantined: "Em quarentena",
  scanning: "Em verificação",
  available: "Disponível",
  rejected: "Rejeitado",
  upload_failed: "Falha no envio"
};

const statusClasses: Record<StorageStatus, string> = {
  quarantined: "bg-amber-50 text-amber-900",
  scanning: "bg-blue-50 text-blue-900",
  available: "bg-emerald-50 text-emerald-900",
  rejected: "bg-red-50 text-red-900",
  upload_failed: "bg-slate-100 text-slate-700"
};

const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

function formatBytes(value: number | null) {
  if (!value || value < 1) return "Tamanho não informado";
  if (value < 1024) return `${value} bytes`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" })
    .format(new Date(value + "T12:00:00"));
}

function normalizeStatus(value: string): StorageStatus {
  return value in statusLabels ? value as StorageStatus : "quarantined";
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [caseFilter, setCaseFilter] = useState("all");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadLibrary() {
      try {
        const [documentsResponse, casesResponse] = await Promise.all([
          fetch("/api/documentos"),
          fetch("/api/processos")
        ]);
        const [documentsPayload, casesPayload] = await Promise.all([
          documentsResponse.json(),
          casesResponse.json()
        ]);

        if (!documentsResponse.ok) {
          throw new Error(documentsPayload.error ?? "Não foi possível carregar a biblioteca.");
        }
        if (!casesResponse.ok) {
          throw new Error(casesPayload.error ?? "Não foi possível carregar os processos.");
        }
        if (cancelled) return;

        setDocuments((documentsPayload.documents ?? []).map((item: DocumentRecord) => ({
          ...item,
          status: normalizeStatus(item.status)
        })));
        setCases((casesPayload.cases ?? []).map((item: CaseOption) => ({
          id: item.id,
          title: item.title
        })));
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Falha ao carregar a biblioteca.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLibrary();
    return () => { cancelled = true; };
  }, []);

  const visibleDocuments = useMemo(() => documents.filter((document) => {
    const searchable = `${document.title} ${document.fileName} ${document.caseTitle}`
      .toLocaleLowerCase("pt-BR");
    return searchable.includes(query.toLocaleLowerCase("pt-BR")) &&
      (caseFilter === "all" || document.caseId === caseFilter);
  }), [documents, query, caseFilter]);

  const quarantinedCount = documents.filter((item) => item.status === "quarantined" || item.status === "scanning").length;
  const availableCount = documents.filter((item) => item.status === "available").length;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="text-sm font-semibold text-teal-700 hover:underline">← Painel inicial</Link>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Acervo jurídico</p>
            <h1 className="mt-1 text-3xl font-bold text-juris-navy">Biblioteca de documentos</h1>
            <p className="mt-1 text-sm text-slate-600">Documentos reais vinculados somente aos processos que sua conta pode acessar.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-fit rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">Upload suspenso para proteção</span>
            <Link href="/gestao" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Gestão jurídica</Link>
          </div>
        </header>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          <strong>Proteção de arquivos:</strong> o armazenamento é privado e os metadados são filtrados pelo RLS. O scanner antimalware ainda não foi integrado; por isso, a interface não permite novos envios e nenhum arquivo em quarentena pode ser baixado.
        </div>

        {message && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{message}</div>}
        {loading && <p role="status" className="mt-4 text-sm text-slate-600">Carregando documentos autorizados...</p>}

        <section className="mt-7 grid gap-4 sm:grid-cols-3" aria-label="Resumo documental">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Documentos registrados</p>
            <p className="mt-2 text-3xl font-bold text-juris-navy">{documents.length}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Em quarentena / verificação</p>
            <p className="mt-2 text-3xl font-bold text-juris-navy">{quarantinedCount}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Disponíveis</p>
            <p className="mt-2 text-3xl font-bold text-juris-navy">{availableCount}</p>
          </article>
        </section>

        <section className="mt-7 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Acervo</h2>
            <p className="mt-1 text-sm text-slate-500">A consulta respeita o acesso do usuário a cada processo.</p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700 md:col-span-2">Buscar
              <input className={field} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome do arquivo ou processo" />
            </label>
            <label className="text-sm font-medium text-slate-700">Processo
              <select className={field} value={caseFilter} onChange={(event) => setCaseFilter(event.target.value)}>
                <option value="all">Todos os processos autorizados</option>
                {cases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-5 space-y-3">
            {visibleDocuments.map((document) => (
              <article key={document.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">{document.title}</h3>
                    <p className="mt-1 break-all text-sm text-slate-600">{document.fileName}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {document.caseTitle} · {formatDate(document.createdAt)} · {formatBytes(document.sizeBytes)}
                    </p>
                    {document.mimeType && <p className="mt-1 text-xs text-slate-500">{document.mimeType}</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[document.status]}`}>
                      {statusLabels[document.status]}
                    </span>
                    {document.status === "available" && (
                      <a
                        href={`/api/documentos/${document.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Baixar
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
            {!loading && visibleDocuments.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                {documents.length === 0
                  ? "Ainda não há documentos registrados nos processos que sua conta pode acessar."
                  : "Nenhum documento corresponde aos filtros selecionados."}
              </div>
            )}
          </div>
        </section>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          Os arquivos não são expostos diretamente pelo Storage. Downloads só serão liberados após verificação confiável e autorização renovada pelo servidor.
        </p>
      </div>
    </main>
  );
}
