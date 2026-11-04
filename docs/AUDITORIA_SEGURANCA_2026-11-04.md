# JurisAI — auditoria de integração e segurança
**Atualização:** 04/11/2026  
**Escopo:** branch de desenvolvimento e Supabase JurisAI-Desenvolvimento. Produção e `main` permanecem inalteradas.

## Estado confirmado

- Repositório: `Mulekotecps2022/JurisAI`.
- Branch de trabalho: `work/jurisai-primeira-entrega-2026-11-02`.
- A branch continua divergente da `main`; não fazer merge automático. Recalcular ahead/behind antes de abrir qualquer PR.
- Supabase de desenvolvimento: `qvmkafixxfahabcgtlgz`, região `sa-east-1`, PostgreSQL 17, estado ativo/saudável.
- Projeto antigo `jurisai-db`: inativo e não alterado.
- Seis migrations registradas no banco de desenvolvimento, incluindo `fk_supporting_indexes` (versão remota `20261104161807`).
- Bucket `case-documents`: privado, limite de 25 MiB e allowlist MIME.
- Nenhum dado de produção foi copiado para o projeto de desenvolvimento.

## Funções privilegiadas

Foram encontradas seis funções `SECURITY DEFINER` no schema `public`. Cinco têm EXECUTE concedido a `authenticated`: `can_access_case`, `can_access_tenente`, `can_edit_case`, `can_manage_case_access` e `is_platform_admin`. A sexta, `handle_new_auth_user_profile`, é função de trigger e não concede EXECUTE a `authenticated`.

A concessão às cinco funções é intencional: são chamadas pelas políticas RLS para avaliar acesso e evitar recursão. As definições observadas usam `search_path = ''`, referências qualificadas e revogam EXECUTE de `PUBLIC` e `anon`. Não revogar indiscriminadamente EXECUTE de `authenticated`, pois isso pode quebrar as próprias políticas.

## Tabela legada `public."CASE"`

A tabela maiúscula é distinta de `public.case`. RLS está habilitado, não há policies e os privilégios de SELECT de `anon` e `authenticated` estão revogados. A tabela permanece fechada enquanto sua finalidade não for comprovada. Não renomear, mesclar ou excluir nesta etapa.

## Índices de chaves estrangeiras

A auditoria inicial encontrou três FKs sem índice de suporte:
- `public.case(tenente_id)`;
- `public.case_access(granted_by)`;
- `public.document(created_by_user_id)`.

A migration `fk_supporting_indexes` foi aplicada com sucesso no projeto de desenvolvimento. Os três índices foram confirmados no catálogo. Nova auditoria identificou 12 FKs e encontrou índice de suporte para todas elas.

O arquivo de origem está em `supabase/migrations/20261104130000_fk_supporting_indexes.sql`; o Supabase registrou a execução sob a versão `20261104161807`. Essa diferença de timestamp deve ser reconciliada com a convenção de migrations do Supabase CLI antes de usar `db push`/deploy automatizado por CLI. Não aplicar novamente às cegas.

## RLS e Storage

As tabelas jurídicas minúsculas têm RLS habilitado e policies por operação. A tabela maiúscula permanece fechada. O bucket é privado e não possui policy de acesso direto para navegador. Upload e assinatura de URL são operações server-side com chave privilegiada.

Foi corrigida a rota de download: primeiro valida a sessão e lê os metadados pela sessão do usuário, sob RLS; somente depois utiliza o cliente administrativo server-only para emitir URL assinada por 300 segundos. O navegador não recebe a chave secreta. URL já emitida permanece válida até expirar; uma revogação bloqueia novas autorizações, mas não invalida retroativamente um link já assinado.

## CI e testes

O workflow foi ajustado para aplicar todas as migrations SQL em ordem alfabética no PostgreSQL descartável, executar o novo teste de índices e manter os testes multiusuário. A fixture de CI foi alinhada para instalar pgvector no schema `extensions`, como a migration de baseline espera.

Os arquivos estão na branch, mas a aprovação da execução de GitHub Actions ainda não pôde ser confirmada por meio do conector disponível. O status de deployment da Vercel não deve ser confundido com aprovação do workflow de segurança. Não declarar CI verde até obter logs/resultado dos jobs.

## Limitações e bloqueios

- Não há scanner antimalware integrado. Uploads devem permanecer em quarentena; downloads continuam bloqueados até existir inspeção confiável.
- A checagem de extensão/MIME/assinatura é preliminar; DOCX/XLSX exigem inspeção estrutural e antimalware.
- A interface `/documentos` ainda usa registros fictícios em memória e não está conectada ao banco nem ao endpoint de upload.
- O workspace de gestão também precisa de integração real com Supabase e de rotas protegidas.
- Ainda faltam testes end-to-end reais de Auth, RLS, upload, assinatura/expiração e revogação.
- O ambiente Cloudflare ainda precisa de secrets, deployment e smoke tests validados.

## Próxima sequência segura

1. Confirmar execução do GitHub Actions e corrigir qualquer falha antes de tratar o CI como aprovado.
2. Corrigir e testar a integração de download com cliente administrativo server-only, já versionada.
3. Integrar login, processos, participantes e documentos às consultas Supabase sob RLS.
4. Fazer testes com proprietário, editor, viewer, usuário sem vínculo e anônimo.
5. Integrar scanner/quarentena antes de liberar downloads.
6. Validar secrets e deploy Cloudflare em desenvolvimento.
7. Só então planejar a consolidação; sem merge automático com `main` e sem alterações em produção.
