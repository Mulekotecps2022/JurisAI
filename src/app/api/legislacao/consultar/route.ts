import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SUPPORTED_LAWS, extractArticleExcerpt } from "@/features/assistant/legislation-lookup";

export const runtime="nodejs";
const paramsSchema=z.object({
  law:z.enum(["cc","cpc"]),
  article:z.coerce.number().int().min(1).max(2046)
});
function errorResponse(message:string,status:number) {
 return NextResponse.json({error:message},{status,headers:{"Cache-Control":"no-store"}});
}

export async function GET(request:NextRequest) {
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.auth.getUser();
 if(error||!data.user) return errorResponse("Autenticação necessária.",401);
 const parsed=paramsSchema.safeParse({
   law:request.nextUrl.searchParams.get("law"),
   article:request.nextUrl.searchParams.get("article")
 });
 if(!parsed.success) return errorResponse("Selecione uma lei e informe um artigo válido.",400);
 const {law,article}=parsed.data;
 const source=SUPPORTED_LAWS[law];
 if(article>source.maxArticle) return errorResponse("Número de artigo fora do intervalo permitido para esta lei.",400);
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),8500);
 try {
  // Fixed HTTPS URLs only; never accept caller-supplied URLs or follow redirects.
  const response=await fetch(source.url,{
   cache:"no-store",redirect:"error",
   headers:{Accept:"text/html"},
   signal:controller.signal
  });
  if(!response.ok) return errorResponse("A fonte oficial não pôde ser consultada agora. Nenhum texto será apresentado como verificado.",503);
  const type=response.headers.get("content-type")??"";
  if(!/text\/html/i.test(type)) return errorResponse("A fonte oficial não retornou uma página HTML reconhecida.",503);
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength>4500000) return errorResponse("A página oficial excedeu o limite de tamanho da consulta.",503);
  const charset=/charset=([\w-]+)/i.exec(type)?.[1]??"utf-8";
  let html:string;
  try{html=new TextDecoder(charset).decode(bytes);}
  catch{html=new TextDecoder("utf-8").decode(bytes);}
  // Reject access-denied pages masquerading as HTML.
  if(/acesso negado|esta requisição foi bloqueada/i.test(html.slice(0,12000))) return errorResponse("O órgão oficial bloqueou a consulta automática. Nenhuma citação foi verificada.",503);
  const result=extractArticleExcerpt(html,article);
  if(!result) return errorResponse("Não foi possível localizar com segurança esse artigo no texto oficial. Abra a fonte e confira manualmente.",404);
  return NextResponse.json({
   verifiedFetch:true,
   law:source.label,
   article,
   excerpt:result.text,
   truncated:result.truncated,
   source:{institution:"Câmara dos Deputados · Legislação Informatizada",url:source.url},
   retrievedAt:new Date().toISOString(),
   disclaimer:"Trecho extraído da página oficial nesta consulta; não é revisão de vigência, contexto, jurisprudência nem parecer jurídico."
  },{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 }catch{
  return errorResponse("Não foi possível consultar a fonte oficial neste momento. Nenhuma citação foi verificada.",503);
 }finally{clearTimeout(timeout);}
}
