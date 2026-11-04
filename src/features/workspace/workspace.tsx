"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { participantRoleLabels, personKindLabels, personInputSchema, type ParticipantRole, type PersonKind } from "@/features/participants/domain";
import { caseInputSchema } from "@/features/cases/domain";

type Person = { id:string; name:string; kind:PersonKind; email:string; phone:string; notes:string; createdAt:string };
type Participant = { personId:string; role:ParticipantRole };
type LegalCase = { id:string; title:string; description:string; participants:Participant[]; createdAt:string };

const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
const primary = "rounded-lg bg-juris-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800";
const secondary = "rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50";
const dateLabel = (v:string) => new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium"}).format(new Date(v+"T12:00:00"));

export default function Workspace() {
 const [people,setPeople]=useState<Person[]>([]), [cases,setCases]=useState<LegalCase[]>([]), [loading,setLoading]=useState(true);
 const [tab,setTab]=useState<"overview"|"people"|"cases">("overview"), [query,setQuery]=useState("");
 const [personForm,setPersonForm]=useState(false), [caseForm,setCaseForm]=useState(false), [message,setMessage]=useState("");
 const [name,setName]=useState(""), [kind,setKind]=useState<PersonKind>("individual"), [email,setEmail]=useState(""), [phone,setPhone]=useState(""), [notes,setNotes]=useState("");
 const [title,setTitle]=useState(""), [description,setDescription]=useState(""), [personId,setPersonId]=useState(""), [role,setRole]=useState<ParticipantRole>("client"), [selected,setSelected]=useState("c1");
 useEffect(()=>{
  let cancelled=false;
  async function loadWorkspace(){
   try{
    const [peopleResponse,casesResponse]=await Promise.all([fetch("/api/pessoas"),fetch("/api/processos")]);
    const [peoplePayload,casesPayload]=await Promise.all([peopleResponse.json(),casesResponse.json()]);
    if(!peopleResponse.ok) throw new Error(peoplePayload.error??"Não foi possível carregar pessoas.");
    if(!casesResponse.ok) throw new Error(casesPayload.error??"Não foi possível carregar processos.");
    if(cancelled) return;
    setPeople(peoplePayload.people??[]);
    setCases(casesPayload.cases??[]);
    if(casesPayload.cases?.[0]?.id) setSelected(casesPayload.cases[0].id);
   }catch(error){
    if(!cancelled) setMessage(error instanceof Error?error.message:"Falha ao carregar o ambiente jurídico.");
   }finally{
    if(!cancelled) setLoading(false);
   }
  }
  void loadWorkspace();
  return ()=>{cancelled=true;};
 },[]);
 const visiblePeople=useMemo(()=>people.filter(p=>(p.name+" "+p.email+" "+p.phone).toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))),[people,query]);
 const visibleCases=useMemo(()=>cases.filter(c=>(c.title+" "+c.description).toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))),[cases,query]);
 const chosen=cases.find(c=>c.id===selected) ?? cases[0];
 async function savePerson(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const parsed=personInputSchema.safeParse({name,kind,email,phone,notes});
  if(!parsed.success){setMessage(parsed.error.issues[0]?.message??"Confira os dados.");return;}
  try{
   const response=await fetch("/api/pessoas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(parsed.data)});
   const payload=await response.json();
   if(!response.ok) throw new Error(payload.error??"Não foi possível salvar o cadastro.");
   setPeople(old=>[payload.person,...old]);
   setName("");setEmail("");setPhone("");setNotes("");setPersonForm(false);setTab("people");
   setMessage("Cadastro salvo no ambiente seguro do JurisAI.");
  }catch(error){setMessage(error instanceof Error?error.message:"Não foi possível salvar o cadastro.");}
 }
 async function saveCase(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const parsed=caseInputSchema.safeParse({title,description,participants:personId?[{personId,role}]:[]});
  if(!parsed.success){setMessage(parsed.error.issues[0]?.message??"Confira os dados.");return;}
  try{
   const response=await fetch("/api/processos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(parsed.data)});
   const payload=await response.json();
   if(!response.ok) throw new Error(payload.error??"Não foi possível salvar o processo.");
   setCases(old=>[payload.case,...old]);setSelected(payload.case.id);
   setTitle("");setDescription("");setPersonId("");setCaseForm(false);setTab("cases");
   setMessage(payload.warning??"Processo salvo no ambiente seguro do JurisAI.");
  }catch(error){setMessage(error instanceof Error?error.message:"Não foi possível salvar o processo.");}
 }
 const tabs=[["overview","Visão geral"],["people","Pessoas e partes"],["cases","Processos"]] as const;
 return <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10"><div className="mx-auto max-w-7xl">
  <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between"><div><Link href="/" className="text-sm font-semibold text-teal-700 hover:underline">← Painel inicial</Link><p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Ambiente de trabalho</p><h1 className="mt-1 text-3xl font-bold text-juris-navy">Gestão jurídica</h1><p className="mt-1 text-sm text-slate-600">Organize pessoas, partes e processos em um só lugar.</p></div><div className="flex flex-wrap items-center gap-2"><Link href="/documentos" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Biblioteca de documentos</Link><span className="w-fit rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">Dados protegidos por autenticação e RLS</span></div></header>
  <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950"><strong>Ambiente conectado:</strong> pessoas e processos são carregados e salvos no Supabase. A visibilidade e as alterações seguem as políticas RLS e o vínculo de acesso de cada processo.</div>
  <nav aria-label="Seções da gestão jurídica" className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">{tabs.map(([id,label])=><button key={id} type="button" onClick={()=>{setTab(id);setQuery("");setMessage("");}} aria-current={tab===id?"page":undefined} className={tab===id?"rounded-lg bg-juris-navy px-4 py-2.5 text-sm font-semibold text-white":"rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"}>{label}</button>)}</nav>
  {loading&&<p role="status" className="mt-4 text-sm text-slate-600">Carregando pessoas e processos autorizados...</p>}
  {message&&<div role="status" className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">{message}</div>}
  {tab==="overview"&&<section className="mt-7"><h2 className="text-xl font-bold text-slate-900">Resumo do ambiente</h2><p className="mt-1 text-sm text-slate-600">Visão rápida dos cadastros desta demonstração.</p><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Pessoas cadastradas</p><p className="mt-2 text-3xl font-bold text-juris-navy">{people.length}</p><button className="mt-4 text-sm font-semibold text-teal-700" onClick={()=>setTab("people")}>Abrir cadastros →</button></article><article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Processos organizados</p><p className="mt-2 text-3xl font-bold text-juris-navy">{cases.length}</p><button className="mt-4 text-sm font-semibold text-teal-700" onClick={()=>setTab("cases")}>Abrir processos →</button></article><article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Vínculos entre partes e processos</p><p className="mt-2 text-3xl font-bold text-juris-navy">{cases.reduce((n,c)=>n+c.participants.length,0)}</p><p className="mt-4 text-xs text-slate-500">Papéis jurídicos independentes do acesso à plataforma.</p></article></div><div className="mt-7 grid gap-5 lg:grid-cols-2"><article className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-bold text-slate-900">Cadastros recentes</h3>{people.slice(0,4).map(p=><div key={p.id} className="flex justify-between gap-3 border-b border-slate-100 py-3 text-sm"><span className="font-medium text-slate-800">{p.name}<small className="block text-slate-500">{personKindLabels[p.kind]}</small></span><span className="text-xs text-slate-500">{dateLabel(p.createdAt)}</span></div>)}</article><article className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-bold text-slate-900">Processos recentes</h3>{cases.slice(0,4).map(c=><div key={c.id} className="border-b border-slate-100 py-3 text-sm"><p className="font-medium text-slate-800">{c.title}</p><p className="text-xs text-slate-500">{c.participants.length} participante(s) · {dateLabel(c.createdAt)}</p></div>)}</article></div></section>}
  {tab==="people"&&<section className="mt-7"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-bold text-slate-900">Pessoas e partes</h2><p className="mt-1 text-sm text-slate-600">Cadastre pessoas físicas ou jurídicas e reutilize-as em diferentes processos.</p></div><button className={primary} onClick={()=>{setPersonForm(v=>!v);setMessage("");}}>＋ Novo cadastro</button></div>
   {personForm&&<form onSubmit={savePerson} className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold">Novo cadastro</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium sm:col-span-2">Nome completo ou razão social<input required minLength={2} maxLength={180} value={name} onChange={e=>setName(e.target.value)} className={field} placeholder="Nome da pessoa ou empresa"/></label><label className="text-sm font-medium">Tipo<select value={kind} onChange={e=>setKind(e.target.value as PersonKind)} className={field}><option value="individual">Pessoa física</option><option value="organization">Pessoa jurídica</option></select></label><label className="text-sm font-medium">E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} className={field} placeholder="email@exemplo.com"/></label><label className="text-sm font-medium">Telefone<input value={phone} onChange={e=>setPhone(e.target.value)} className={field} placeholder="(00) 00000-0000"/></label><label className="text-sm font-medium sm:col-span-2">Observações<textarea rows={3} maxLength={4000} value={notes} onChange={e=>setNotes(e.target.value)} className={field}/></label></div><div className="mt-5 flex gap-2"><button className={primary} type="submit">Salvar cadastro</button><button className={secondary} type="button" onClick={()=>setPersonForm(false)}>Cancelar</button></div></form>}
   <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><label className="block text-sm font-medium">Buscar pessoas<input value={query} onChange={e=>setQuery(e.target.value)} className={field} placeholder="Nome, e-mail ou telefone"/></label><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Nome</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Contato</th><th className="px-3 py-3">Cadastro</th></tr></thead><tbody className="divide-y divide-slate-100">{visiblePeople.map(p=><tr key={p.id}><td className="px-3 py-4 font-semibold">{p.name}</td><td className="px-3 py-4">{personKindLabels[p.kind]}</td><td className="px-3 py-4">{p.email||p.phone||"—"}</td><td className="px-3 py-4 text-slate-500">{dateLabel(p.createdAt)}</td></tr>)}</tbody></table>{visiblePeople.length===0&&<p className="py-8 text-center text-sm text-slate-500">Nenhum cadastro encontrado.</p>}</div></div>
  </section>}
  {tab==="cases"&&<section className="mt-7"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-bold text-slate-900">Processos e casos</h2><p className="mt-1 text-sm text-slate-600">Organize os assuntos e relacione cada pessoa ao papel que exerce no caso.</p></div><button className={primary} onClick={()=>{setCaseForm(v=>!v);setMessage("");}}>＋ Novo processo</button></div>
   {caseForm&&<form onSubmit={saveCase} className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold">Novo processo ou caso</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium sm:col-span-2">Título<input required minLength={3} maxLength={240} value={title} onChange={e=>setTitle(e.target.value)} className={field} placeholder="Ex.: Reclamação trabalhista — cliente"/></label><label className="text-sm font-medium sm:col-span-2">Descrição<textarea rows={3} maxLength={10000} value={description} onChange={e=>setDescription(e.target.value)} className={field}/></label><label className="text-sm font-medium">Participante inicial<select value={personId} onChange={e=>setPersonId(e.target.value)} className={field}><option value="">Sem participante por enquanto</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="text-sm font-medium">Papel no processo<select value={role} onChange={e=>setRole(e.target.value as ParticipantRole)} className={field}>{Object.entries(participantRoleLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div><div className="mt-5 flex gap-2"><button className={primary} type="submit">Salvar processo</button><button className={secondary} type="button" onClick={()=>setCaseForm(false)}>Cancelar</button></div></form>}
   <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)]"><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><label className="block text-sm font-medium">Buscar processos<input value={query} onChange={e=>setQuery(e.target.value)} className={field} placeholder="Título ou descrição"/></label><div className="mt-4 space-y-2">{visibleCases.map(c=><button key={c.id} type="button" onClick={()=>setSelected(c.id)} className={selected===c.id?"w-full rounded-lg border border-teal-300 bg-teal-50 p-4 text-left":"w-full rounded-lg border border-slate-200 p-4 text-left hover:bg-slate-50"}><span className="block text-sm font-semibold">{c.title}</span><span className="mt-1 block text-xs text-slate-500">{c.participants.length} participante(s) · {dateLabel(c.createdAt)}</span></button>)}{visibleCases.length===0&&<p className="py-8 text-center text-sm text-slate-500">Nenhum processo encontrado.</p>}</div></div><aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{chosen?<><p className="text-xs font-bold uppercase tracking-wide text-teal-700">Detalhes do processo</p><h3 className="mt-2 text-lg font-bold">{chosen.title}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{chosen.description||"Sem descrição cadastrada."}</p><div className="mt-5 border-t pt-4"><h4 className="text-sm font-bold">Pessoas vinculadas</h4>{chosen.participants.length?chosen.participants.map(v=>{const p=people.find(x=>x.id===v.personId);return <div key={v.personId} className="mt-3 flex justify-between gap-2 text-sm"><span className="font-medium">{p?.name??"Cadastro não localizado"}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{participantRoleLabels[v.role]}</span></div>}):<p className="mt-2 text-sm text-slate-500">Nenhuma pessoa vinculada ainda.</p>}</div><p className="mt-5 text-xs text-slate-500">Criado em {dateLabel(chosen.createdAt)}</p></>:<p className="text-sm text-slate-500">Selecione um processo.</p>}</aside></div>
  </section>}
  <footer className="mt-10 border-t border-slate-200 py-5 text-xs text-slate-500">JurisAI · Dados jurídicos protegidos por autenticação, propriedade e políticas RLS do Supabase.</footer>
 </div></main>;
}
