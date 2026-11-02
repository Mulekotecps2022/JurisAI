# JurisAI

Plataforma privada de gestão e inteligência jurídica.

## Estado atual

O projeto está em migração gradual do protótipo HTML para uma aplicação Next.js com TypeScript. O protótipo original permanece no arquivo `index.html` como referência e não foi removido.

A nova interface inicial está em `src/app`. A integração com Supabase está preparada estruturalmente, mas permanece sem credenciais de ambiente e sem operações de negócio até a confirmação do schema e das políticas RLS.

## Requisitos

- Node.js 20.9 ou superior.
- npm.

## Desenvolvimento local

1. Copie `.env.example` para `.env.local`.
2. Preencha as variáveis públicas do projeto Supabase somente no ambiente local.
3. Instale dependências com `npm install`.
4. Inicie com `npm run dev`.

## Comandos

- `npm run dev`: servidor local.
- `npm run build`: build de produção.
- `npm run typecheck`: verificação TypeScript.
- `npm run lint`: análise estática.

## Supabase

Leia `docs/DIAGNOSTICO_SUPABASE.md` e execute o diagnóstico somente leitura em `supabase/diagnostics/inspect_schema.sql` antes de implementar tabelas, migrations ou consultas definitivas.

## Documentação

- [Arquitetura e roteiro](docs/ARQUITETURA_E_ROTEIRO.md)
- [Diagnóstico do Supabase](docs/DIAGNOSTICO_SUPABASE.md)

## Segurança

Nunca commitar `.env.local`, service-role keys, tokens privados ou dados reais de clientes/processos. A chave anon/public não substitui políticas RLS no banco.
