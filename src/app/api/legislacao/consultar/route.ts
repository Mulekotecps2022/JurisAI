import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SUPPORTED_LAWS } from "@/features/assistant/legislation-lookup";
import { retrieveOfficialArticle } from "@/features/assistant/verified-law-retrieval";

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
 const result=await retrieveOfficialArticle(law,article);
 if(!result) return errorResponse("Os portais oficiais consultados não forneceram um texto verificável agora. Nenhuma citação foi gerada; confira a legislação nos links oficiais.",503);
 return NextResponse.json(result,{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
