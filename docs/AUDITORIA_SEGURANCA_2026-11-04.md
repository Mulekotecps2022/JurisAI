# JurisAI — auditoria de integração e segurança
**Atualização:** 04/11/2026  
**Escopo:** branch de desenvolvimento e Supabase JurisAI-Desenvolvimento. Produção e `main` permanecem inalteradas.

## Estado confirmado

- Repositório: `Mulekotecps2022/JurisAI`.
- Branch de trabalho: `work/jurisai-primeira-entrega-2026-11-02`; continua divergente da `main`. Não fazer merge automático.
- PR #1 está em rascunho exclusivamente para revisão/CI; não mesclar.
- Supabase de desenvolvimento: `qvmkafixxfahabcgtlgz`, região `sa-east-1`, PostgreSQL 17, ativo/saudável.
- Projeto antigo `jurisai-db`: inativo e não alterado.
- Sete migrations registradas no banco de desenvolvimento, incluindo `fk_supporting_indexes` (versão `20261104161807`) e `people_contact_fields` (versão `20261104162829`).
- Bucket `case-documents`: privado, limite 25 MiB e allowlist MIME.
- Nenhum dado de produção foi copiado para o projeto de desenvolvimento.

## Funções privilegiadas

Foram encontradas seis funções `SECURITY DEFINER` no schema `public`. Cinco têm EXECUTE concedido a `authenticated`: `can_access_case`, `can_access_tenente`, `can_edit_case`, `can_manage_case_access` e `is_platform_admin`. A sexta, `handle_new_auth_user_profile`, é função de trigger e não concede EXECUTE a `authenticated`.

A concessão às cinco funções é intencional: são chamadas pelas políticas RLS para avaliar acesso e evitar recursão. As definições observadas usam `search_path = ''`, referências qualificadas e revogam EXECUTE de `PUBLIC` e `anon`. Não revogar indiscriminadamente EXECUTE de `authenticated`, pois isso pode quebrar as próprias políticas.

## Tabela legada `public."CASE"`

A tabela maiúscula é distinta de `public.case`. RLS está habilitado, não há policies e os privilégios de SELECT de `anon` e `authenticated` estão revogados. A tabela permanece fechada enquanto sua finalidade não for comprovada. Não renomear, mesclar ou excluir nesta etapa.

## Índices de chaves estrangeiras

A auditoria inicial encontrou três FKs sem índice de suporte: `public.case(tenente_id)`, `public.case_access(granted_by)` e `public.document(created_by_user_id)`.

A migration `fk_supporting_indexes` foi aplicada com sucesso no projeto de desenvolvimento. Os três índices foram confirmados no catálogo; nova auditoria encontrou índices de suporte para as 12 FKs auditadas.

O arquivo de origem está em `supabase/migrations/20261104130000_fk_supporting_indexes.sql`; o Supabase registrou a execução sob a versão `20261104161807`. Essa diferença de timestamp deve ser reconciliada com a convenção de migrations do Supabase CLI antes de automatizar `db push`. Não reaplicar às cegas.

## Pessoas, processos e tipos

A migration `people_contact_fields` foi aplicada no ambiente de desenvolvimento (versão remota `20261104162829`). Foram adicionados `kind`, `email`, `phone` e `notes` em `public.tenentes`, mantendo o registro legado e as policies de RLS. Os grants permitem criar/editar dados de contato, mas não permitem alterar `created_by_user_id`; `anon` não tem SELECT.

Os tipos de `src/types/database.ts` foram regenerados diretamente do schema de desenvolvimento. A migration de campos de contato tem origem em `20261104162600_people_contact_fields.sql`, aplicada pelo Supabase sob a versão remota `20261104162829`.

Foram implementadas APIs:
- `GET/POST /api/pessoas`, com validação Zod, sessão Auth e RLS;
- `GET/POST /api/processos`, com criação de processo pelo usuário autenticado e relação com participantes jurídicos, sujeita às policies RLS.

O workspace de gestão deixou de usar registros fictícios e passou a carregar/salvar pessoas e processos por essas APIs. O módulo ainda requer validação end-to-end com contas reais.

## RLS, Storage e rotas privadas

As tabelas jurídicas minúsculas têm RLS habilitado e policies por operação. A tabela maiúscula permanece fechada. O bucket é privado e não possui policy de acesso Storage direta para navegador.

A rota de download valida a sessão e lê metadados pelo cliente do usuário sob RLS; somente depois utiliza o cliente administrativo server-only para emitir URL assinada por 300 segundos. A chave secreta nunca vai ao navegador. URL já emitida permanece válida até expirar; revogação bloqueia novas assinaturas, mas não invalida retroativamente link já assinado.

As telas `/gestao` e `/documentos` exigem sessão autenticada no middleware. Sem configuração de Auth, falham fechadas. O magic link preserva destino relativo e o callback rejeita origem externa. Os endpoints validam a sessão por conta própria.

## CI e testes

O workflow aplica todas as migrations SQL em ordem no PostgreSQL descartável, executa testes estruturais e comportamento multiusuário, testes de contrato, lint, TypeScript, build Next.js e build Cloudflare.

- Execução `41867212044`: lint, typecheck, testes de contrato, builds e bateria SQL concluídos com sucesso para o estágio de schema.
- Execução `41867455145`: bateria SQL passou; TypeScript falhou porque os tipos ainda refletiam o schema anterior. Os tipos foram regenerados e commitados.
- Execução mais recente observada `41867624972`: typecheck, testes de contrato e bateria SQL passaram; build de produção/Cloudflare ainda precisava terminar no momento desta atualização.

Execução mais recente observada: GitHub Actions run 41869129364 concluído com sucesso nos dois jobs (lint, TypeScript, testes de contrato, build Next.js, build Cloudflare, migrations e testes SQL multiusuário).

## Limitações e bloqueios

- **Auth ainda sem identidade inicial:** o projeto de desenvolvimento tem zero usuários em `auth.users` e zero perfis em `app_user_profiles`. Não há login real possível até convidar a conta inicial e promover o perfil para `platform_admin`. Não inventar nem inserir identidade manualmente.
- Não há scanner antimalware. Uploads devem permanecer em quarentena; downloads não devem ser liberados até inspeção confiável.
- A checagem de extensão/MIME/assinatura é preliminar; DOCX/XLSX exigem inspeção estrutural e antimalware.
- A interface `/documentos` ainda usa dados fictícios em memória e não está conectada ao banco nem ao endpoint de upload.
- Ainda faltam testes end-to-end de Auth, RLS, upload, assinatura/expiração e revogação com identidades reais.
- O ambiente Cloudflare ainda precisa de secrets, deployment e smoke tests validados.
- O timestamp local das migrations deve ser reconciliado com as versões registradas pelo Supabase antes de automatizar deploy via CLI.

## Próxima sequência segura

1. Confirmar que o workflow mais recente termina integralmente em sucesso.
2. Convidar a conta inicial no Supabase Auth e atribuir `platform_admin` somente depois de confirmar a identidade.
3. Testar owner/editor/viewer/usuário sem vínculo/anon em Auth/RLS.
4. Conectar a biblioteca de documentos e integrar scanner/quarentena antes de liberar downloads.
5. Validar secrets e deploy Cloudflare em desenvolvimento.
6. Resolver a divergência de migrations/branch e só então planejar consolidação; sem merge automático com `main` e sem alterações em produção.
