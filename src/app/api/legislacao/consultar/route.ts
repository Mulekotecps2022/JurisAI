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
 const candidates=[
  {url:source.url,institution:"Câmara dos Deputados · Legislação Informatizada"},
  {url:source.secondaryUrl,institution:"Senado Federal · Legislação Federal"}
 ];
 // All URLs are fixed governmental HTTPS endpoints. Never follow redirects to other hosts.
 for(const candidate of candidates) {
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),7500);
  try {
   const response=await fetch(candidate.url,{
    cache:"no-store",redirect:"error",
    headers:{Accept:"text/html", "User-Agent":"JurisAI-Legislation-Research/1.0"},
    signal:controller.signal
   });
   if(!response.ok) continue;
   const type=response.headers.get("content-type")??"";
   if(!type.toLowerCase().includes("text/html")) continue;
   const declaredLength=Number(response.headers.get("content-length")??"0");
   if(declaredLength>6500000) continue;
   const bytes=await response.arrayBuffer();
   if(bytes.byteLength>6500000) continue;
   const charset=/charset=([\\w-]+)/i.exec(type)?.[1]??"utf-8";
   let html:string;
   try{html=new TextDecoder(charset).decode(bytes);}
   catch{html=new TextDecoder("utf-8").decode(bytes);}
   if(/acesso negado|esta requisição foi bloqueada/i.test(html.slice(0,12000))) continue;
   // Require the statute number, not just an arbitrary paragraph containing 'Art. 189'.
   const statuteNumber=law==="cc"?"10.406":"13.105";
   if(!html.includes(statuteNumber)) continue;
   const result=extractArticleExcerpt(html,article);
   if(!result) continue;
   return NextResponse.json({
    verifiedFetch:true,law:source.label,article,
    excerpt:result.text,truncated:result.truncated,
    source:{institution:candidate.institution,url:candidate.url},
    retrievedAt:new Date().toISOString(),
    disclaimer:"Trecho extraído da publicação oficial consultada. Não substitui a conferência da redação, vigência e contexto jurídico."
   },{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }catch{
   // Timeouts and network errors must never turn into fabricated legal content.
  }finally{clearTimeout(timeout);}
 }
 return errorResponse("Os portais oficiais consultados não forneceram um texto verificável agora. Nenhuma citação foi gerada; confira a legislação nos links oficiais.",503);
}
