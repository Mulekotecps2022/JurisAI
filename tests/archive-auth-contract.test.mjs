import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("archive endpoint requires authenticated owner and never deletes a case", async () => {
  const route = await read("../src/app/api/processos/[caseId]/arquivamento/route.ts");
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /\.eq\("owner_user_id", auth\.user\.id\)/);
  assert.match(route, /\.update\(\{ archived_at:/);
  assert.doesNotMatch(route, /\.delete\(/);
});

test("confirmation endpoint exchanges a valid PKCE code and rejects missing codes", async () => {
  const callback = await read("../src/app/auth/confirm/route.ts");
  assert.match(callback, /searchParams\.get\("code"\)/);
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.match(callback, /error=missing_code/);
});

test("preview login uses one canonical callback origin", async () => {
  const login = await read("../src/app/login/page.tsx");
  assert.match(login, /NEXT_PUBLIC_APP_URL/);
  assert.match(login, /emailRedirectTo: callbackUrl\.toString\(\)/);
  assert.match(login, /shouldCreateUser: false/);
});

test("email confirmation supports token-hash links without a PKCE browser verifier", async () => {
  const callback = await read("../src/app/auth/confirm/route.ts");
  assert.match(callback, /searchParams\.get\("token_hash"\)/);
  assert.match(callback, /tokenType !== "email"/);
  assert.match(callback, /auth\.verifyOtp\(\{ token_hash: tokenHash!, type: "email" \}\)/);
  assert.match(callback, /auth\.exchangeCodeForSession\(code\)/);
  assert.match(callback, /candidateUrl\.origin === appUrl\.origin/);
});

test("email OTP form verifies eight-digit codes without creating public users", async () => {
  const login = await read("../src/app/login/page.tsx");
  assert.ok(login.includes("auth.verifyOtp({"));
  assert.ok(login.includes("token: otp"));
  assert.ok(login.includes('type: "email"'));
  assert.ok(login.includes("otp.length !== 8"));
  assert.ok(login.includes("pattern=\"[0-9]{8}\""));
  assert.ok(login.includes("shouldCreateUser: false"));
  assert.ok(login.includes("window.location.assign(safeNext)"));
});


test("person creation rejects repeated identical owner records and locks rapid resubmission", async () => {
  const route = await read("../src/app/api/pessoas/route.ts");
  const workspace = await read("../src/features/workspace/workspace.tsx");
  assert.ok(route.includes('.eq("created_by_user_id", user.id)'));
  assert.ok(route.includes('.eq("name", parsed.data.name)'));
  assert.ok(route.includes('if (isDuplicate) return errorResponse('));
  assert.ok(route.includes('409)'));
  assert.ok(workspace.includes('if(savingPersonRef.current) return;'));
  assert.ok(workspace.includes('disabled={savingPerson}'));
});

test("existing-case participant linking requires the case owner and a known person", async () => {
 const route=await read("../src/app/api/processos/[caseId]/participantes/route.ts");
 const workspace=await read("../src/features/workspace/workspace.tsx");
 assert.ok(route.includes('.eq("owner_user_id", auth.user.id)'));
 assert.ok(route.includes('.eq("created_by_user_id", auth.user.id)'));
 assert.ok(route.includes('legalCase.archived_at'));
 assert.ok(route.includes('error?.code === "23505"'));
 assert.ok(workspace.includes('linkExistingPerson'));
 assert.ok(workspace.includes('Vincular pessoa cadastrada'));
});

test("AI assistant remains disabled without explicit verified free plan and server-side key", async () => {
 const api=await read("../src/app/api/assistente/route.ts");
 const home=await read("../src/app/page.tsx");
 const middleware=await read("../src/lib/supabase/middleware.ts");
 assert.match(api, /GROQ_FREE_PLAN_CONFIRMED === "true"/);
 assert.match(api, /process\.env\.GROQ_API_KEY/);
 assert.match(api, /if \(!isReady\(\)\) return json\(/);
 assert.match(api, /auth\.getUser\(\)/);
 assert.match(api, /try_consume_ai_free_request/);
 assert.match(api, /max_completion_tokens: 700/);
 assert.match(api, /response\.status === 429/);
 assert.match(api, /https:\/\/api\.groq\.com\/openai\/v1\/chat\/completions/);
 assert.match(middleware, /pathname === "\/assistente"/);
 assert.match(home, /href: "\/assistente"/);
 assert.doesNotMatch(api, /NEXT_PUBLIC_GROQ_API_KEY/);
});


test("AI legal answers explicitly avoid fabricated deadlines and warn about hallucinations", async () => {
 const api=await read("../src/app/api/assistente/route.ts");
 const page=await read("../src/app/assistente/page.tsx");
 assert.ok(api.includes("prescrição atinge a pretensão"));
 assert.ok(api.includes("decadência legal não se suspende nem se interrompe"));
 assert.ok(api.includes("não invente prazo universal"));
 assert.ok(api.includes("não afirme ter verificado legislação ou precedentes"));
 assert.ok(page.includes("pode inventar prazos, artigos e precedentes"));
});

test("AI official legal sources have whitelisted government and court URLs", async () => {
 const catalog=await read("../src/features/assistant/official-sources.ts");
 const api=await read("../src/app/api/assistente/route.ts");
 const ui=await read("../src/app/assistente/page.tsx");
 assert.ok(catalog.includes("OFFICIAL_LEGAL_SOURCES"));
 assert.ok(catalog.includes("selectOfficialSources"));
 assert.ok(catalog.includes("https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm"));
 assert.ok(catalog.includes("https://jurisprudencia.stf.jus.br/"));
 assert.ok(catalog.includes("https://www.stj.jus.br/sites/portalp/"));
 assert.ok(api.includes('sourceStatus: "official_links_not_live_verified"'));
 assert.ok(api.includes("estas páginas não foram abertas nem lidas"));
 assert.ok(ui.includes("Biblioteca de fontes jurídicas oficiais"));
 assert.ok(ui.includes("não citações verificadas"));
 assert.ok(ui.includes('rel="noopener noreferrer"'));
});

test("official legislation retrieval is authenticated, allowlisted, bounded and fail closed", async () => {
 const route=await read("../src/app/api/legislacao/consultar/route.ts");
 const parser=await read("../src/features/assistant/legislation-lookup.ts");
 const page=await read("../src/app/assistente/page.tsx");
 assert.ok(route.includes("supabase.auth.getUser()"));
 assert.ok(route.includes('z.enum(["cc","cpc"])'));
 assert.ok(route.includes("SUPPORTED_LAWS[law]"));
 assert.ok(route.includes('redirect:"error"'));
 assert.ok(route.includes('cache:"no-store"'));
 assert.ok(route.includes("7500"));
 assert.ok(route.includes("6500000"));
 assert.ok(route.includes("extractArticleExcerpt(html,article)"));
 assert.ok(route.includes("Nenhuma citação foi gerada"));
 assert.ok(route.includes("retrievedAt:new Date().toISOString()"));
 assert.ok(parser.includes("www2.camara.leg.br/legin/fed/lei/2002/"));
 assert.ok(parser.includes("www2.camara.leg.br/legin/fed/lei/2015/"));
 assert.ok(parser.includes("htmlToLegalLines"));
 assert.ok(parser.includes("extractArticleExcerpt"));
 assert.ok(page.includes("Consulta direta à legislação oficial"));
 assert.ok(page.includes("/api/legislacao/consultar?law="));
 assert.ok(page.includes("Texto recuperado da fonte oficial"));
 assert.ok(page.includes("Trecho abreviado"));
});

test("official Senate fallback is restricted to fixed legal texts and does not invent citations", async () => {
 const route=await read("../src/app/api/legislacao/consultar/route.ts");
 const sources=await read("../src/features/assistant/legislation-lookup.ts");
 assert.ok(sources.includes("https://legis.senado.leg.br/norma/552282/publicacao/34620807"));
 assert.ok(sources.includes("https://legis.senado.leg.br/norma/584917/publicacao/34619046"));
 assert.ok(route.includes("source.secondaryUrl"));
 assert.ok(route.includes('redirect:"error"'));
 assert.ok(route.includes("if(!response.ok) continue"));
 assert.ok(route.includes("if(!result) continue"));
 assert.ok(route.includes("verifiedFetch:true"));
});
