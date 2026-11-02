"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  documentCategoryLabels,
  documentInputSchema,
  documentStatusLabels,
  type DocumentCategory,
  type DocumentStatus
} from "@/features/documents/domain";

type CaseOption = { id: string; title: string };
type DocumentRecord = {
  id: string;
  title: string;
  caseId: string;
  category: DocumentCategory;
  fileName: string;
  notes: string;
  status: DocumentStatus;
  createdAt: string;
};

const caseOptions: CaseOption[] = [
  { id: "case-1", title: "Ação trabalhista — exemplo" },
  { id: "case-2", title: "Análise contratual — exemplo" }
];

const initialDocuments: DocumentRecord[] = [
  {
    id: "doc-1",
    title: "Petição inicial — modelo demonstrativo",
    caseId: "case-1",
    category: "petition",
    fileName: "peticao-inicial-exemplo.pdf",
    notes: "Registro fictício para demonstrar a organização da biblioteca.",
    status: "reviewed",
    createdAt: "2026-10-30"
  },
  {
    id: "doc-2",
    title: "Comprovante — exemplo",
    caseId: "case-1",
    category: "evidence",
    fileName: "comprovante-exemplo.jpg",
    notes: "Evidência demonstrativa, sem arquivo real anexado.",
    status: "in_review",
    createdAt: "2026-11-01"
  },
  {
    id: "doc-3",
    title: "Contrato para revisão — exemplo",
    caseId: "case-2",
    category: "contract",
    fileName: "contrato-exemplo.docx",
    notes: "",
    status: "received",
    createdAt: "2026-11-02"
  }
];

const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
const button = "rounded-lg bg-juris-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800";
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value + "T12:00:00"));

export default function DocumentsPage() {
  const [documents, setDocuments] = useState(initialDocuments);
  const [query, setQuery] = useState("");
  const [caseFilter, setCaseFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [caseId, setCaseId] = useState(caseOptions[0].id);
  const [category, setCategory] = useState<DocumentCategory>("other");
  const [fileName, setFileName] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<DocumentStatus>("received");

  const visibleDocuments = useMemo(() => documents.filter((document) => {
    const search = (document.title + " " + document.fileName + " " + document.notes)
      .toLocaleLowerCase("pt-BR");
    return search.includes(query.toLocaleLowerCase("pt-BR"))
      && (caseFilter === "all" || document.caseId === caseFilter)
      && (categoryFilter === "all" || document.category === categoryFilter);
  }), [documents, query, caseFilter, categoryFilter]);

  function saveDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = documentInputSchema.safeParse({ title, caseId, category, fileName, notes, status });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Confira os dados informados.");
      return;
    }
    setDocuments((current) => [{
      id: "doc-" + Date.now(),
      ...parsed.data,
      notes: parsed.data.notes ?? "",
      createdAt: new Date().toISOString().slice(0, 10)
    }, ...current]);
    setTitle("");
    setFileName("");
    setNotes("");
    setFormOpen(false);
    setMessage("Metadados adicionados somente nesta demonstração. Nenhum arquivo foi enviado ou armazenado.");
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="text-sm font-semibold text-teal-700 hover:underline">← Painel inicial</Link>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Acervo jurídico</p>
            <h1 className="mt-1 text-3xl font-bold text-juris-navy">Biblioteca de documentos</h1>
            <p className="mt-1 text-sm text-slate-600">Organize documentos por processo, categoria e etapa de análise.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-fit rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">Demonstração local</span>
            <Link href="/gestao" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Gestão jurídica</Link>
          </div>
        </header>

        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
          <strong>Privacidade:</strong> esta versão trabalha apenas com registros fictícios e metadados em memória. Não selecione nem envie documentos reais. Upload, armazenamento privado, leitura de arquivos e análise por IA serão habilitados depois da implantação e dos testes das políticas de acesso.
        </div>

        {message && <div role="status" className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">{message}</div>}

        <section className="mt-7 grid gap-4 sm:grid-cols-3" aria-label="Resumo documental">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Registros demonstrativos</p>
            <p className="mt-2 text-3xl font-bold text-juris-navy">{documents.length}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Em análise</p>
            <p className="mt-2 text-3xl font-bold text-juris-navy">{documents.filter((item) => item.status === "in_review").length}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Analisados</p>
            <p className="mt-2 text-3xl font-bold text-juris-navy">{documents.filter((item) => item.status === "reviewed").length}</p>
          </article>
        </section>

        <section className="mt-7 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Acervo</h2>
              <p className="mt-1 text-sm text-slate-500">Pesquise e filtre os registros desta demonstração.</p>
            </div>
            <button type="button" className={button} onClick={() => { setFormOpen((open) => !open); setMessage(""); }}>
              {formOpen ? "Fechar cadastro" : "＋ Registrar documento"}
            </button>
          </div>

          {formOpen && (
            <form onSubmit={saveDocument} className="mt-5 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Título do documento
                <input className={field} value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={240} placeholder="Ex.: Laudo pericial" />
              </label>
              <label className="text-sm font-medium text-slate-700">Processo relacionado
                <select className={field} value={caseId} onChange={(event) => setCaseId(event.target.value)}>
                  {caseOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">Categoria
                <select className={field} value={category} onChange={(event) => setCategory(event.target.value as DocumentCategory)}>
                  {Object.entries(documentCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">Nome do arquivo (referência)
                <input className={field} value={fileName} onChange={(event) => setFileName(event.target.value)} required maxLength={255} placeholder="arquivo.pdf" />
              </label>
              <label className="text-sm font-medium text-slate-700">Etapa
                <select className={field} value={status} onChange={(event) => setStatus(event.target.value as DocumentStatus)}>
                  {Object.entries(documentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Observações
                <textarea className={field} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} placeholder="Notas sobre o documento (opcional)" />
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button type="submit" className={button}>Salvar registro demonstrativo</button>
                <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button>
              </div>
            </form>
          )}

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700 md:col-span-1">Buscar
              <input className={field} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Título, arquivo ou observação" />
            </label>
            <label className="text-sm font-medium text-slate-700">Processo
              <select className={field} value={caseFilter} onChange={(event) => setCaseFilter(event.target.value)}>
                <option value="all">Todos os processos</option>
                {caseOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Categoria
              <select className={field} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">Todas as categorias</option>
                {Object.entries(documentCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-5 space-y-3">
            {visibleDocuments.map((document) => {
              const relatedCase = caseOptions.find((item) => item.id === document.caseId);
              return (
                <article key={document.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900">{document.title}</h3>
                      <p className="mt-1 break-all text-sm text-slate-600">{document.fileName}</p>
                      <p className="mt-2 text-xs text-slate-500">{relatedCase?.title ?? "Processo não identificado"} · {dateLabel(document.createdAt)}</p>
                      {document.notes && <p className="mt-2 text-sm leading-6 text-slate-600">{document.notes}</p>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{documentCategoryLabels[document.category]}</span>
                      <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">{documentStatusLabels[document.status]}</span>
                    </div>
                  </div>
                </article>
              );
            })}
            {visibleDocuments.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">Nenhum registro corresponde aos filtros selecionados.</div>}
          </div>
        </section>
        <p className="mt-5 text-xs leading-5 text-slate-500">Os exemplos acima são fictícios. Os registros criados nesta tela existem somente na memória da sessão e serão perdidos ao atualizar ou fechar a página.</p>
      </div>
    </main>
  );
}
