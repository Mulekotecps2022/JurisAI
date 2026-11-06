import { SUPPORTED_LAWS, extractArticleExcerpt, type SupportedLaw } from "./legislation-lookup";

export type VerifiedLawExcerpt = {
  verifiedFetch: true;
  law: string;
  article: number;
  excerpt: string;
  truncated: boolean;
  source: {institution: string; url: string};
  retrievedAt: string;
  disclaimer: string;
};

/** Only explicit mentions of an article AND a law. Never guess a statute. */
export function parseExplicitArticle(question: string): {law:SupportedLaw;article:number}|null {
  const text=question.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const cc=/\bcodigo civil\b|\blei\s*(?:n[.º°o]*\s*)?10[.]?406\s*\/\s*2002\b/.test(text);
  const cpc=/\bcpc\b|\bcodigo de processo civil\b|\blei\s*(?:n[.º°o]*\s*)?13[.]?105\s*\/\s*2015\b/.test(text);
  if(cc===cpc) return null; // both or neither are ambiguous
  const matches=[...text.matchAll(/\bart(?:igo)?\.?\s*(\d{1,4})(?!\d)/g)];
  if(matches.length!==1) return null;
  const article=Number(matches[0][1]);
  const law:SupportedLaw=cpc?"cpc":"cc";
  if(article<1||article>SUPPORTED_LAWS[law].maxArticle) return null;
  return {law,article};
}

/** Retrieves an exact article from fixed official HTTPS hosts; never user-supplied URLs. */
export async function retrieveOfficialArticle(law: SupportedLaw,article:number):Promise<VerifiedLawExcerpt|null> {
  const source=SUPPORTED_LAWS[law];
  if(!Number.isInteger(article)||article<1||article>source.maxArticle) return null;
  const candidates=[
    {url:source.url,institution:"Câmara dos Deputados · Legislação Informatizada"},
    {url:source.secondaryUrl,institution:"Senado Federal · Legislação Federal"}
  ];
  for(const candidate of candidates) {
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),6500);
    try{
      const response=await fetch(candidate.url,{
        cache:"no-store",redirect:"error",
        headers:{Accept:"text/html","User-Agent":"JurisAI-Legislation-Research/1.0"},
        signal:controller.signal
      });
      if(!response.ok) continue;
      const type=response.headers.get("content-type")??"";
      if(!type.toLowerCase().includes("text/html")) continue;
      const declaredLength=Number(response.headers.get("content-length")??"0");
      if(declaredLength>6500000) continue;
      const bytes=await response.arrayBuffer();
      if(bytes.byteLength>6500000) continue;
      const charset=type.toLowerCase().split("charset=")[1]?.split(";")[0]?.trim()??"utf-8";
      let html:string;
      try{html=new TextDecoder(charset).decode(bytes);}
      catch{html=new TextDecoder("utf-8").decode(bytes);}
      if(/acesso negado|esta requisição foi bloqueada/i.test(html.slice(0,12000))) continue;
      const statuteNumber=law==="cc"?"10.406":"13.105";
      if(!html.includes(statuteNumber)) continue;
      const result=extractArticleExcerpt(html,article);
      if(!result) continue;
      return {
        verifiedFetch:true,law:source.label,article,
        excerpt:result.text,truncated:result.truncated,
        source:{institution:candidate.institution,url:candidate.url},
        retrievedAt:new Date().toISOString(),
        disclaimer:"Trecho extraído da publicação oficial consultada. Não substitui a conferência da redação, vigência e contexto jurídico."
      };
    }catch{
      // Fail closed; never infer a legal quote from missing source text.
    }finally{clearTimeout(timeout);}
  }
  return null;
}
