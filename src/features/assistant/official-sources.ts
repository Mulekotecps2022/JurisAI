/**
 * Curated official legal research entry points.
 * These are NOT citations to passages retrieved in this request.
 * Do not label any link as a verified quote, judicial precedent, or live legal search.
 */
export type OfficialLegalSource = {
  id: string;
  title: string;
  institution: string;
  kind: "legislacao" | "jurisprudencia";
  url: string;
  note: string;
};

export const OFFICIAL_LEGAL_SOURCES: readonly OfficialLegalSource[] = [
  {
    id: "cc", title: "Código Civil — Lei nº 10.406/2002",
    institution: "Presidência da República · Planalto", kind: "legislacao",
    url: "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm",
    note: "Texto oficial compilado; confirme artigos, redação e vigência na fonte."
  },
  {
    id: "cpc", title: "Código de Processo Civil — Lei nº 13.105/2015",
    institution: "Presidência da República · Planalto", kind: "legislacao",
    url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm",
    note: "Texto oficial; confira prazos e alterações na fonte."
  },
  {
    id: "cf", title: "Constituição Federal de 1988",
    institution: "Presidência da República · Planalto", kind: "legislacao",
    url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicaocompilado.htm",
    note: "Texto oficial compilado; confira emendas e vigência."
  },
  {
    id: "clt", title: "Consolidação das Leis do Trabalho",
    institution: "Presidência da República · Planalto", kind: "legislacao",
    url: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm",
    note: "Texto oficial compilado; confira alterações e dispositivos."
  },
  {
    id: "stf", title: "Pesquisa de jurisprudência do STF",
    institution: "Supremo Tribunal Federal", kind: "jurisprudencia",
    url: "https://jurisprudencia.stf.jus.br/",
    note: "Portal oficial para verificar existência, inteiro teor, tema e data de julgados."
  },
  {
    id: "stj", title: "Pesquisa de jurisprudência do STJ",
    institution: "Superior Tribunal de Justiça", kind: "jurisprudencia",
    url: "https://www.stj.jus.br/sites/portalp/paginas/Sob-medida/Advogado/Jurisprudencia/Pesquisa-de-Jurisprudencia.aspx",
    note: "Portal oficial para pesquisar decisões, súmulas e informativos; não houve busca automática."
  }
];

export function selectOfficialSources(query: string): OfficialLegalSource[] {
  const text = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const related: string[] = [];
  if (/prescri|decaden|civil|contrat|obrigac|indeniz|familia|sucess|heranc|locac/.test(text)) related.push("cc");
  if (/process|procediment|petic|recurso|contestac|audiencia|prazo|execuc|tutela/.test(text)) related.push("cpc");
  if (/constituc|fundament|direit.os human|direit.os fundamental|liberdade|habeas/.test(text)) related.push("cf");
  if (/trabalh|empreg|clt|ferias|rescis|salari/.test(text)) related.push("clt");
  if (/stf|supremo|constitucional|repercussao geral/.test(text)) related.push("stf");
  if (/stj|jurisprud|sumula|precedent|repetitivo/.test(text)) related.push("stj");
  const ids = related.length ? [...new Set(related)] : ["cf", "cc"];
  return OFFICIAL_LEGAL_SOURCES.filter(source => ids.includes(source.id)).slice(0, 4);
}
