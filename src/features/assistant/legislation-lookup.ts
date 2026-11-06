/**
 * Controlled legal text lookup. URLs are hardcoded official publications.
 * Extracted text is a sourced excerpt, NOT an AI-generated summary.
 */
export const SUPPORTED_LAWS = {
  cc: {
    label: "Código Civil (Lei nº 10.406/2002)",
    url: "https://www2.camara.leg.br/legin/fed/lei/2002/lei-10406-10-janeiro-2002-432893-normaatualizada-pl.html",
    secondaryUrl: "https://legis.senado.leg.br/norma/552282/publicacao/34620807",
    maxArticle: 2046
  },
  cpc: {
    label: "Código de Processo Civil (Lei nº 13.105/2015)",
    url: "https://www2.camara.leg.br/legin/fed/lei/2015/lei-13105-16-marco-2015-780273-normaatualizada-pl.html",
    secondaryUrl: "https://legis.senado.leg.br/norma/584917/publicacao/34619046",
    maxArticle: 1072
  }
} as const;

export type SupportedLaw = keyof typeof SUPPORTED_LAWS;

const entities: Record<string,string> = {
  nbsp:" ", amp:"&", lt:"<", gt:">", quot:'"', apos:"'",
  aacute:"á", eacute:"é", iacute:"í", oacute:"ó", uacute:"ú",
  agrave:"à", atilde:"ã", otilde:"õ", ccedil:"ç",
  acirc:"â", ecirc:"ê", ocirc:"ô", ordm:"º", sect:"§",
  ndash:"–", mdash:"—", rsquo:"’", ldquo:"“", rdquo:"”"
};

export function htmlToLegalLines(html: string): string[] {
  return html.replace(/<!--[\s\S]*?-->/g," ")
    .replace(/<(script|style|svg|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi," ")
    .replace(/<\s*br\s*\/?>/gi,"\n")
    .replace(/<\/?(?:p|div|h[1-6]|li|tr|section|article|blockquote)\b[^>]*>/gi,"\n")
    .replace(/<[^>]+>/g," ")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(_,entity:string)=>{
      const name=entity.toLowerCase();
      const code=name.startsWith("#x")?parseInt(name.slice(2),16):name.startsWith("#")?parseInt(name.slice(1),10):null;
      if(code!==null) return code>=32 && code<=0x10ffff ? String.fromCodePoint(code) : " ";
      return entities[name]??" ";
    })
    .split(/\n+/)
    .map(line=>line.replace(/[\t\r\u00a0 ]+/g," ").trim())
    .filter(Boolean);
}

export function extractArticleExcerpt(html: string, article: number): { text: string; truncated: boolean } | null {
  const lines=htmlToLegalLines(html);
  // A real dispositive must begin a paragraph; references to articles in notes are not a match.
  const startPattern=new RegExp("^Art\\.?\\s*"+article+"\\s*(?:[º°.]|\\b)\\s*","i");
  const anyArticle=/^Art\.?\s*\d{1,4}(?:-[A-Z])?\s*(?:[º°.]|\b)/i;
  const start=lines.findIndex(line=>startPattern.test(line) && line.length>=13);
  if(start<0) return null;
  const parts:string[]=[];
  for(let index=start; index<Math.min(lines.length,start+12); index++){
    const line=lines[index];
    if(index>start && anyArticle.test(line)) break;
    if(index>start && /^(?:CAP[IÍ]TULO|SE[CÇ][AÃ]O|T[IÍ]TULO|LIVRO|PARTE)\b/i.test(line)) break;
    parts.push(line);
    if(parts.join(" ").length>1200) break;
  }
  const full=parts.join("\n").trim();
  if(!startPattern.test(full) || full.length<20) return null;
  const limited=full.slice(0,1200);
  return {text:limited,truncated:full.length>limited.length || parts.join(" ").length>1200};
}
