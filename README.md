# JurisAI

Plataforma privada de gestão e inteligência jurídica.

## Estado atual

O projeto está em migração gradual do protótipo HTML para uma aplicação Next.js com TypeScript. O protótipo original permanece no arquivo `index.html` como referência e não foi removido.

A nova interface inicial está em `src/app`. A integração SSR com Supabase está preparada com publishable key e atualização de sessão por middleware. A autenticação ainda não protege módulos de negócio; nenhuma operação de dados jurídicos será liberada antes das políticas RLS.

## Requisitos

- Node.js 20.9 ou superior.
- npm.

## Desenvolvimento local

1. Copie `.env.example` para `.env.local`.
2. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no ambiente local, usando a publishable key do projeto. Não use a service-role/secret key no navegador.
3. Instale dependências com `npm install`.
4. Inicie com `npm run dev`.

## Comandos

- `npm run dev`: servidor local.
- `npm run build`: build Next.js de produção.
- `npm run build:cf`: adapta a build para Cloudflare Workers.
- `npm run preview:cf`: executa a versão adaptada localmente no runtime Workers.
- `npm run deploy:cf`: publica no Cloudflare (requer autenticação e autorização de deploy).
- `npm run typecheck`: verificação TypeScript.
- `npm run lint`: análise estática.

## Cloudflare Workers

A implantação está preparada com OpenNext e Wrangler. A configuração fica em `wrangler.jsonc` e `open-next.config.ts`. O deploy não foi executado; exige autenticação Cloudflare e validação do build no runtime Workers. Não configure segredos no repositório.

## Supabase

Leia `docs/DIAGNOSTICO_SUPABASE.md` e execute o diagnóstico somente leitura em `supabase/diagnostics/inspect_schema.sql` antes de implementar tabelas, migrations ou consultas definitivas.

## Documentação

- [Arquitetura e roteiro](docs/ARQUITETURA_E_ROTEIRO.md)
- [Diagnóstico do Supabase](docs/DIAGNOSTICO_SUPABASE.md)

## Segurança

Nunca commitar `.env.local`, service-role keys, tokens privados ou dados reais de clientes/processos. A chave anon/public não substitui políticas RLS no banco.


## Modelo de domínio

- [Modelo de domínio — Pessoas e Partes](docs/MODELO_DE_DOMINIO.md)
- [Diagnóstico real do Supabase](docs/DIAGNOSTICO_SUPABASE.md)
- [Modelo de segurança e autorização](docs/MODELO_DE_SEGURANCA.md)
