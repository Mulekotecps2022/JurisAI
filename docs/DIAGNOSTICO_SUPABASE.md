# Diagnóstico do Supabase — JurisAI

## Objetivo

Descobrir o schema real antes de criar migrations, tipos TypeScript, políticas ou operações de gravação.

## Evidência disponível no repositório

O protótipo atual referencia:
- tabela `tenentes`, com leitura de `name` e `created_at`, e inserção de `name`;
- tabela `case`, com leitura de `title` ou `name` e `created_at`, e inserção de `title`.

Essas referências são apenas evidência do que o frontend espera. Elas **não comprovam** que as tabelas ou colunas existam, nem que as permissões estejam corretas.

## Como obter o schema sem expor dados pessoais

1. Abra o projeto correto no painel Supabase.
2. Entre em SQL Editor.
3. Abra e execute `supabase/diagnostics/inspect_schema.sql`.
4. Compartilhe os resultados das consultas, ou exporte somente a estrutura (schema-only), sem linhas de dados.

O script consulta metadados de tabelas, colunas, políticas RLS, estado do RLS, constraints e triggers. Ele não executa INSERT, UPDATE, DELETE, DROP ou ALTER e não consulta registros de clientes ou processos.

## O que será validado

- Se `tenentes` e `case` existem e em qual schema.
- Tipos, nulabilidade e defaults das colunas.
- Chaves primárias e relacionamentos.
- Se RLS está habilitado/forçado.
- Políticas de SELECT, INSERT, UPDATE e DELETE.
- Triggers que possam preencher timestamps ou outros campos.

## Critério para avançar

Não implementar operações definitivas, migrations de negócio nem tipos gerados manualmente até que os resultados sejam revisados. Depois da inspeção, gerar os tipos TypeScript a partir do schema confirmado e planejar migrations pequenas, reversíveis e revisadas.
