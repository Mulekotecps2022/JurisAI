# JurisAI — auditoria de integração e segurança
**Data:** 04/11/2026  
**Escopo:** branch de desenvolvimento e projeto Supabase isolado. Produção e `main` não foram alteradas.

## Estado confirmado

- Repositório: `Mulekotecps2022/JurisAI`.
- Branch de trabalho: `work/jurisai-primeira-entrega-2026-11-02`.
- Comparação com `main`: 155 commits à frente e 2 atrás; histórico divergente. Não realizar merge automático.
- Supabase `JurisAI-Desenvolvimento`: projeto `qvmkafixxfahabcgtlgz`, região `sa-east-1`, PostgreSQL 17, ativo/saudável.
- Projeto antigo `jurisai-db`: inativo; não foi alterado.
- Histórico do ambiente de desenvolvimento: cinco migrations aplicadas — baseline, perfis, propriedade/acesso, cutover RLS e Storage privado.
- Bucket `case-documents`: privado, com limite de 25 MiB e allowlist MIME.
- Nenhum dado de produção foi copiado para o ambiente de desenvolvimento.

## Revisão das funções privilegiadas

Foram encontradas seis funções `SECURITY DEFINER` no schema `public`. Cinco têm EXECUTE concedido a `authenticated`: `can_access_case`, `can_access_tenente`, `can_edit_case`, `can_manage_case_access` e `is_platform_admin`. A sexta, `handle_new_auth_user_profile`, é função de trigger e não concede EXECUTE a `authenticated`.

A concessão às cinco funções é intencional: elas são chamadas pelas políticas RLS para avaliar acesso e evitar recursão de políticas. As definições observadas usam `search_path = ''`, qualificam objetos pelo schema e as migrations revogam EXECUTE de `PUBLIC` e `anon` antes de conceder a `authenticated`. Não revogar indiscriminadamente o acesso de `authenticated`, pois isso pode quebrar as próprias políticas. Manter testes de comportamento e revisar qualquer nova função privilegiada.

## Tabela legada `public."CASE"`

A tabela de identificador maiúsculo é distinta de `public.case`. A auditoria confirmou RLS habilitado e zero políticas. Isso é deliberado: a migration de cutover revoga privilégios de `anon` e `authenticated` e mantém a tabela fechada enquanto sua finalidade permanece desconhecida. Não criar policy permissiva, renomear, mesclar ou excluir a tabela nesta etapa.

## Índices de chaves estrangeiras

A auditoria de índices identificou três FKs sem índice de suporte na coluna de origem:

1. `public.case(tenente_id)` — FK `case_tenente_id_fkey`.
2. `public.case_access(granted_by)` — FK `case_access_granted_by_fkey`.
3. `public.document(created_by_user_id)` — FK `document_created_by_user_id_fkey`.

Os demais vínculos auditados já possuem índice adequado, inclusive por índices compostos cuja primeira coluna corresponde à FK. Foi preparada a migration `20261104130000_fk_supporting_indexes.sql` e o teste estrutural `supabase/tests/fk_supporting_indexes.sql`. A migration adiciona apenas índices; não altera dados, políticas ou permissões.

## RLS e Storage

As tabelas jurídicas minúsculas têm RLS habilitado e políticas específicas por operação. A tabela maiúscula permanece fechada sem policy. O bucket de documentos é privado e não possui policy de acesso direto para navegador; esse comportamento é fail-closed e coerente com o desenho atual, no qual upload e emissão de URL assinada passam por rotas server-side com credencial privilegiada.

Os testes SQL no CI cobrem isolamento por identidade em PostgreSQL descartável e bloqueio de acesso direto a objetos Storage pelo navegador. Isso não substitui testes end-to-end contra Auth, Storage e rotas reais no projeto Supabase de desenvolvimento.

## Limitações que permanecem

- Não há scanner antimalware integrado. Os arquivos permanecem em quarentena; não liberar downloads até existir fluxo confiável de inspeção.
- A validação por assinatura/MIME não substitui análise antimalware.
- É necessário testar login, renovação de sessão, upload, download assinado, expiração e revogação de acesso em ambiente real de desenvolvimento.
- Atualizar documentação histórica para distinguir o diagnóstico inicial (02/11) do estado pós-migrations (04/11).

## Próxima sequência segura

1. Executar CI com a nova migration e o teste estrutural incluídos.
2. Aplicar a migration de índices somente em `JurisAI-Desenvolvimento`, após CI verde.
3. Confirmar os três índices e repetir a auditoria de funções, policies e grants.
4. Testar com contas distintas: proprietário, editor, viewer, usuário sem vínculo e anônimo.
5. Fazer testes reais de autenticação e rotas de documentos; manter downloads bloqueados enquanto não houver scanner.
6. Somente após aprovação, planejar consolidação e eventual promoção. Não fazer merge automático com `main` nem tocar na produção nesta fase.
