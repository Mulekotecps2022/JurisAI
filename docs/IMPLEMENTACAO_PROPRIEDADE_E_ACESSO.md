# Implementação preparatória — propriedade e compartilhamento de processos

**Estado:** migration e testes preparados na branch de desenvolvimento; não aplicados ao Supabase.

## Decisões incorporadas

- `public.case.owner_user_id` referencia `auth.users(id)`.
- A coluna permanece temporariamente nullable. Isso é deliberado: não presumimos proprietário para processos legados.
- `public.case_access` registra colaboradores por processo, com papéis técnicos `editor` e `viewer`.
- O proprietário é a única pessoa autorizada a conceder ou revogar colaboradores.
- Não há UPDATE direto em `case_access`; alteração de papel será revogação e nova concessão, evitando mutação silenciosa.
- `tenentes` continua sendo cadastro de pessoas/entidades e não concede acesso técnico.
- A tabela `CASE` (maiúscula) permanece intocada.

## Arquivos

- Migration: `supabase/migrations/20261103000200_case_ownership_and_access.sql`
- Testes estruturais: `supabase/tests/case_ownership_security.sql`

## Limite deliberado desta fase

Esta migration protege a tabela nova `case_access` com RLS e cria funções auxiliares de consulta de autorização. Ela **não** habilita RLS em `public.case`, `document`, `embedding` ou `tenentes`, e não altera os grants atuais dessas tabelas.

Portanto, esta entrega é uma estrutura preparatória, não uma liberação segura de dados jurídicos. A proteção completa exige uma migration de cutover coordenada que:
1. atribua proprietário de forma explícita a cada processo;
2. defina o tratamento do cadastro legado `tenentes`;
3. habilite RLS e políticas por operação em `case`, `document`, `embedding` e entidades relacionadas;
4. corrija grants de `anon` e `authenticated`;
5. configure políticas privadas de Storage;
6. passe os testes com anon, usuário sem vínculo, owner, editor e viewer.

## Testes

Executar `supabase/tests/case_ownership_security.sql` somente em branch isolada do Supabase depois de aplicar a migration preparatória. Além das assertions estruturais, executar todos os cenários manuais descritos no arquivo.

## Segurança de funções

As funções auxiliares usam `SECURITY DEFINER`, `search_path` vazio, nomes de objetos qualificados e EXECUTE concedido apenas a `authenticated`. Devem ser revisadas novamente junto da migration de cutover e testadas contra bypass/recursão.

**Nenhuma migration foi aplicada ao projeto Supabase principal.**
