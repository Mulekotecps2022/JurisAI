# Operação, segredos e implantação — JurisAI

## Ambientes

- Desenvolvimento: branch GitHub `work/jurisai-primeira-entrega-2026-11-02`.
- Banco principal Supabase: permanece sem migrations novas.
- Banco de CI: PostgreSQL descartável em container, criado do zero a cada execução.
- Produção Cloudflare: não implantada.

## Segredos

Variáveis públicas:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Segredo de servidor:
- `SUPABASE_SECRET_KEY` (preferencial) ou `SUPABASE_SERVICE_ROLE_KEY` (compatibilidade legada).

O segredo de servidor deve ser configurado pelo painel de secrets do ambiente Cloudflare, ou por `wrangler secret put SUPABASE_SECRET_KEY` após autenticação no Wrangler. Nunca colocar o valor em `.env.example` preenchido, código, GitHub, issue, chat, logs ou variáveis `NEXT_PUBLIC_*`.

## Provisionamento do administrador

O procedimento de promoção da conta inicial está documentado em `docs/BOOTSTRAP_ADMIN_INICIAL.md`. Ele usa apenas um marcador de e-mail, sem gravar o identificador pessoal no Git. O bootstrap é executado manualmente no SQL Editor após a migration de perfis, em ambiente isolado.

## Ordem de liberação

1. Aplicar e validar migrations 001–004 em ambiente Supabase isolado.
2. Confirmar testes SQL e comportamentais com owner/editor/viewer/usuário sem vínculo.
3. Configurar segredo privado no ambiente de servidor.
4. Integrar scanner/antimalware e somente então liberar transição de `quarantined` para `available`.
5. Configurar URL/variável pública e publishable key.
6. Fazer preview Cloudflare e smoke tests com dados sintéticos.
7. Somente após aprovação explícita, realizar deploy de produção e cutover do banco.

## Comandos previstos (não executados)

- `npx wrangler secret put SUPABASE_SECRET_KEY`
- `npm run preview:cf`
- `npm run deploy:cf`

Deploy e criação de ambiente de banco podem gerar custos e exigem conta/credenciais e autorização específica. Nenhum desses comandos foi executado.

## Testes automáticos

O workflow de CI agora inclui:
- lint, TypeScript, testes de contrato, build Next.js e build Cloudflare;
- um PostgreSQL 17 descartável com pgvector;
- aplicação sequencial das quatro migrations;
- assertions estruturais de RLS/grants/Storage;
- testes comportamentais com identidades owner, editor, viewer, platform admin e usuário sem vínculo.

O fixture simula as tabelas Auth e Storage necessárias para validar o SQL e o RLS Postgres; não substitui testes de integração contra o serviço real Supabase Storage/Auth.

## Pendências externas

- Criar branch Supabase real de desenvolvimento (custo estimado informado pelo Supabase: US$ 0,01344/h; requer confirmação expressa).
- Configurar a secret do servidor no Cloudflare.
- Escolher e integrar scanner/antimalware confiável.
- Executar smoke tests reais de Auth, Storage, signed URLs e revogação.
- Só depois decidir cutover do banco principal e deploy.


## Cloudflare e process.env

O `wrangler.jsonc` usa compatibilidade Node.js e data de compatibilidade 2026-11-02. A documentação atual do Workers informa que, com `nodejs_compat` e compatibilidade adequada, secrets e variáveis de ambiente podem ser lidos por `process.env`; a população de `process.env` é habilitada por padrão para datas posteriores a 2025-04-01. A configuração real ainda precisa ser verificada em preview com a secret definida no ambiente.

Referências oficiais:
- https://developers.cloudflare.com/workers/configuration/environment-variables/
- https://developers.cloudflare.com/workers/configuration/compatibility-flags/
- https://opennext.js.org/cloudflare/bindings


## Auditoria de dependências — 03/11/2026

O workflow executou `npm audit --omit=dev --audit-level=high` e `npm audit --audit-level=high`: ambos retornaram **zero vulnerabilidades** após atualizar PostCSS e aplicar overrides corrigidos de glob/minimatch. Lint, TypeScript, testes de contrato, build Next.js e build Cloudflare também passaram no run #114.
