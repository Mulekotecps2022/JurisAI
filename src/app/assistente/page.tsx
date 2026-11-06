"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { OFFICIAL_LEGAL_SOURCES, type OfficialLegalSource } from "@/features/assistant/official-sources";
import { SUPPORTED_LAWS, type SupportedLaw } from "@/features/assistant/legislation-lookup";

type Message = { role: "user" | "assistant"; content: string; sources?: OfficialLegalSource[]; verifiedLaw?:LawResult|null };
type Status = "loading" | "ready" | "unconfigured" | "error";
type LawResult = {law:string;article:number;excerpt:string;truncated:boolean;source:{institution:string;url:string};retrievedAt:string;disclaimer:string};

export default function LegalAssistantPage() {
  const [status,setStatus]=useState<Status>("loading");
  const [messages,setMessages]=useState<Message[]>([]);
  const [question,setQuestion]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [law,setLaw]=useState<SupportedLaw>("cc");
  const [article,setArticle]=useState("189");
  const [lawLoading,setLawLoading]=useState(false);
  const [lawResult,setLawResult]=useState<LawResult|null>(null);
  const [lawError,setLawError]=useState("");

  useEffect(()=>{
    let active=true;
    fetch("/api/assistente",{cache:"no-store"}).then(async response=>{
      const result=await response.json();
      if(!active) return;
      setStatus(response.ok?(result.ready?"ready":"unconfigured"):"error");
      if(!response.ok) setError(result.error??"Não foi possível verificar a conexão.");
    }).catch(()=>{if(active){setStatus("error");setError("Falha ao verificar a conexão gratuita.");}});
    return()=>{active=false;};
  },[]);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy||status!=="ready"||question.trim().length<5) return;
    const current=question.trim();
    const previous=messages.slice(-4);
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/assistente",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({question:current,history:previous})
      });
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error??"Falha na consulta.");
      setMessages(old=>[...old,{role:"user",content:current},{role:"assistant",content:payload.answer,sources:Array.isArray(payload.sources)?payload.sources:[],verifiedLaw:payload.verifiedLaw??null}]);
      setQuestion("");
    }catch(e){setError(e instanceof Error?e.message:"Falha na consulta.");}
    finally{setBusy(false);}
  }

  async function consultLaw(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(lawLoading) return;
    setLawLoading(true);setLawResult(null);setLawError("");
    try{
      const response=await fetch(`/api/legislacao/consultar?law=${encodeURIComponent(law)}&article=${encodeURIComponent(article)}`,{cache:"no-store"});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error??"Não foi possível consultar a fonte oficial.");
      setLawResult(payload as LawResult);
    }catch(e){setLawError(e instanceof Error?e.message:"Falha na consulta oficial.");}
    finally{setLawLoading(false);}
  }

  return <main className="min-h-screen px-4 py-7 sm:px-8"><div className="mx-auto max-w-3xl">
   <Link href="/" className="text-sm font-semibold text-teal-700 hover:underline">← Painel inicial</Link>
   <header className="mt-5 border-b border-slate-200 pb-6">
    <p className="text-xs font-bold uppercase tracking-wider text-teal-700">JurisAI · Inteligência artificial</p>
    <h1 className="mt-2 text-3xl font-bold text-juris-navy">Assistente jurídico</h1>
    <p className="mt-2 text-sm leading-6 text-slate-600">Orientação geral, rascunhos e revisão de textos jurídicos em ambiente de testes, com orçamento zero.</p>
   </header>
   <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
    <strong>Privacidade:</strong> use apenas questões e dados fictícios. Quando ativado, o texto digitado será enviado a um provedor externo gratuito; o assistente não acessa automaticamente seus processos, pessoas ou documentos. Não inclua informações sigilosas, CPF ou dados de clientes.
   </div>
   <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
    <strong>Status da IA:</strong> {status==="loading"?"Verificando configuração...":status==="ready"?"Conexão gratuita habilitada, até 8 solicitações por usuário ao dia.":status==="unconfigured"?"Aguardando configuração de uma conta gratuita verificada. Nenhum envio externo está habilitado.":"Não foi possível verificar o serviço."}
    <p className="mt-2 text-sm font-semibold text-red-800">AVISO: o modelo pode inventar prazos, artigos e precedentes mesmo quando responde com convicção. Não use respostas como fundamento de petições, cálculo de prazos ou orientação a clientes sem verificação jurídica independente.</p><p className="mt-2 text-xs text-slate-500">A consulta direta a artigos do Código Civil e CPC é separada da IA; respostas geradas pelo modelo ainda exigem verificação independente.</p>
   </div>
   {messages.length>0&&<section aria-label="Conversa" className="mt-5 space-y-3">{messages.map((item,index)=><article key={index} className={item.role==="user"?"rounded-xl bg-slate-100 p-4":"rounded-xl border border-teal-200 bg-white p-4"}><p className="mb-2 text-xs font-bold uppercase tracking-wide text-teal-700">{item.role==="user"?"Sua pergunta":"Assistente · resposta gerada por IA"}</p><div className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{item.content}</div>{item.role==="assistant"&&<div className="mt-4 border-t border-slate-200 pt-3">{item.verifiedLaw&&<div className="mb-4 rounded-lg border border-teal-300 bg-teal-50 p-3"><p className="text-sm font-bold text-teal-900">Dispositivo recuperado de publicação oficial — Art. {item.verifiedLaw.article}</p><p className="mt-1 text-xs text-slate-600">{item.verifiedLaw.law} · {item.verifiedLaw.source.institution}</p><blockquote className="mt-2 whitespace-pre-wrap border-l-2 border-teal-700 pl-3 text-sm text-slate-900">{item.verifiedLaw.excerpt}{item.verifiedLaw.truncated?"…":""}</blockquote><a href={item.verifiedLaw.source.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-teal-800 underline">Abrir publicação oficial ↗</a><p className="mt-2 text-xs text-slate-600">Apenas este trecho foi recuperado; interpretação da IA, redação integral e vigência exigem revisão.</p></div>}<p className="text-sm font-bold text-slate-800">Outras fontes oficiais sugeridas para conferência</p><p className="mt-1 text-xs leading-5 text-amber-900">Links adicionais, não citações verificadas. A consulta automática de outros textos e decisões não foi realizada.</p><ul className="mt-3 space-y-2">{(item.sources??[]).map(source=><li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-teal-800 underline decoration-dotted underline-offset-4">{source.title} ↗</a><p className="text-xs text-slate-500">{source.institution}</p></li>)}</ul></div>}</article>)}</section>}
   {error&&<p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
   <form onSubmit={ask} className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <label htmlFor="ai-question" className="block text-sm font-bold">Faça uma pergunta jurídica sem dados pessoais</label>
    <textarea id="ai-question" rows={5} maxLength={2000} required minLength={5} value={question} onChange={e=>setQuestion(e.target.value)} disabled={status!=="ready"||busy} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none focus:border-teal-600 disabled:bg-slate-50" placeholder="Ex.: Explique de forma geral a diferença entre prescrição e decadência."/>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-500">{question.length}/2000 caracteres · mínimo de 15 segundos entre pedidos</span><button type="submit" disabled={status!=="ready"||busy||question.trim().length<5} className="rounded-lg bg-juris-navy px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy?"Consultando...":"Perguntar à IA"}</button></div>
   </form>
   <section className="mt-7 rounded-xl border border-teal-200 bg-white p-5 shadow-sm" aria-label="Consulta à legislação oficial">
    <h2 className="text-lg font-bold text-slate-900">Consulta direta à legislação oficial</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">Recupere um artigo do texto atualizado publicado pela Câmara dos Deputados. A consulta usa a fonte oficial diretamente, sem IA e sem consumir tokens da Groq.</p>
    <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end" onSubmit={consultLaw}>
      <label className="text-sm font-semibold">Legislação<select value={law} onChange={e=>{setLaw(e.target.value as SupportedLaw);setLawResult(null);}} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm">{Object.entries(SUPPORTED_LAWS).map(([key,item])=><option key={key} value={key}>{item.label}</option>)}</select></label>
      <label className="text-sm font-semibold">Artigo<input type="number" required min={1} max={SUPPORTED_LAWS[law].maxArticle} value={article} onChange={e=>setArticle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"/></label>
      <button type="submit" disabled={lawLoading||!article} className="rounded-lg bg-juris-navy px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{lawLoading?"Consultando...":"Consultar artigo"}</button>
    </form>
    {lawError&&<p role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{lawError}</p>}
    {lawResult&&<article className="mt-5 rounded-lg border border-teal-200 bg-teal-50/40 p-4">
      <p className="text-sm font-bold text-teal-900">Texto recuperado da fonte oficial — Art. {lawResult.article}</p>
      <p className="mt-2 text-xs text-slate-600">Origem: {lawResult.source.institution} · Consulta em {new Date(lawResult.retrievedAt).toLocaleString("pt-BR")}</p>
      <blockquote className="mt-3 whitespace-pre-wrap break-words border-l-4 border-teal-700 pl-3 text-sm leading-6 text-slate-900">{lawResult.excerpt}{lawResult.truncated?"…":""}</blockquote>
      {lawResult.truncated&&<p className="mt-2 text-xs font-semibold text-amber-900">Trecho abreviado. Abra a página oficial para ler o dispositivo completo.</p>}
      <a href={lawResult.source.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-teal-800 underline">Conferir texto integral no portal oficial ↗</a>
      <p className="mt-2 text-xs leading-5 text-slate-600">{lawResult.disclaimer}</p>
    </article>}
   </section>
   <section className="mt-7 rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold text-slate-900">Biblioteca de fontes jurídicas oficiais</h2><p className="mt-2 text-sm leading-6 text-slate-600">Acesso direto e gratuito a textos legislativos e sistemas oficiais de pesquisa. A consulta automática de artigos está disponível inicialmente para Código Civil e CPC via Câmara dos Deputados. Para as demais fontes, abra cada link e confira redação, vigência e contexto.</p><ul className="mt-4 grid gap-3 sm:grid-cols-2">{OFFICIAL_LEGAL_SOURCES.map(source=><li key={source.id} className="rounded-lg border border-slate-200 p-3"><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-teal-800 underline underline-offset-4">{source.title} ↗</a><p className="mt-1 text-xs text-slate-500">{source.institution}</p><p className="mt-1 text-xs leading-5 text-slate-600">{source.note}</p></li>)}</ul></section>
   <p className="mt-5 text-xs leading-5 text-slate-500">A conversa fica apenas nesta página enquanto aberta e não é salva no banco de dados do JurisAI. O texto de cada solicitação, quando autorizado, é processado pelo provedor externo.</p>
  </div></main>;
}
