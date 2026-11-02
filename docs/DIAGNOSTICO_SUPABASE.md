# Diagnóstico real do Supabase — JurisAI

**Projeto inspecionado:** `vwqzrhybemvhqsbsbfjp`  
**Data da inspeção:** 02/11/2026  
**Método:** metadados PostgreSQL, sem leitura de registros de clientes/processos.

## Resultado: schema encontrado

O banco possui cinco tabelas no schema `public`:

| Tabela | Colunas | Chave primária | Relações |
|---|---:|---|---|
| `tenentes` | 3 | `id uuid` | — |
| `case` | 5 | `id uuid` | `tenente_id → tenentes.id` |
| `CASE` | 3 | `id bigint` | — |
| `document` | 5 | `id uuid` | `case_id → case.id` |
| `embedding` | 5 | `id uuid` | `document_id → document.id` |

O PostgreSQL diferencia identificadores com aspas e sem aspas. Portanto, `CASE` e `case` são duas tabelas distintas. A tabela `CASE` tem uma coluna `Name` com N maiúsculo; a tabela `case` usa `title`, `description` e `tenente_id`.

### Colunas observadas

- `tenentes`: `id uuid` (gerado por `gen_random_uuid()`), `name text NOT NULL`, `created_at timestamptz NOT NULL`.
- `case`: `id uuid` (gerado por `gen_random_uuid()`), `tenente_id uuid NULL`, `title text NOT NULL`, `description text NULL`, `created_at timestamptz NOT NULL`.
- `CASE`: `id bigint NOT NULL`, `created_at timestamptz NOT NULL`, `Name text NULL`. Não há default observado para `id` nem `created_at`.
- `document`: `id uuid` (gerado por `gen_random_uuid()`), `case_id uuid NULL`, `file_name text NOT NULL`, `file_path text NULL`, `created_at timestamptz NOT NULL`.
- `embedding`: `id uuid` (gerado por `gen_random_uuid()`), `document_id uuid NULL`, `content text NOT NULL`, `vector vector NULL`, `created_at timestamptz NOT NULL`.

Há chaves estrangeiras com `ON DELETE CASCADE` em `case.tenente_id`, `document.case_id` e `embedding.document_id`. A extensão `vector 0.8.2` está instalada no schema `public`; o advisor recomenda movê-la para um schema dedicado, mas isso exige avaliar dependências antes de qualquer alteração. O tamanho/dimensão do vetor ainda precisa ser confirmado antes de implementar busca semântica. O advisor de performance também identificou ausência de índices de cobertura para as três chaves estrangeiras acima.

## Segurança: alerta que exige correção planejada

Estado de Row Level Security observado:

| Tabela | RLS habilitado | RLS forçado |
|---|---:|---:|
| `CASE` | Sim | Não |
| `case` | Não | Não |
| `document` | Não | Não |
| `embedding` | Não | Não |
| `tenentes` | Não | Não |

A consulta de metadados também encontrou privilégios de tabela concedidos a `anon`, `authenticated` e `service_role`, incluindo operações de escrita em tabelas do schema público. Não foram encontradas políticas RLS no schema `public`. Na tabela `CASE`, RLS está habilitado mas sem políticas listadas.

**Interpretação:** as quatro tabelas com RLS desabilitado não têm a barreira de políticas por linha. Com os privilégios observados, isso representa risco de exposição ou alteração indevida por chamadas que usem a API pública. Na tabela `CASE`, a ausência de políticas tende a bloquear as operações sujeitas a RLS, mas os privilégios amplos continuam precisando de revisão.

Nenhuma migration foi registrada no histórico do Supabase no momento da inspeção. Nenhuma alteração foi aplicada ao banco nesta inspeção. Não foram revogados privilégios nem ativado RLS automaticamente para evitar indisponibilidade e bloqueio de operações legítimas antes de definir a identidade, o modelo de proprietário/tenant e as políticas corretas. O advisor de segurança do Supabase confirmou os quatro alertas `rls_disabled_in_public` e o alerta `rls_enabled_no_policy` para `public.CASE`.

## Divergência importante com o protótipo

O HTML antigo referencia `tenentes` e `case`, que existem. Porém, o histórico de implementação do frontend tinha variações entre `name` e `title`. O schema confirma que a tabela `case` possui `title NOT NULL`, e não possui coluna `name`. A tabela adicional `CASE` possui `Name`, mas não tem relação declarada com `tenentes` nem com `case`.

Não assumir que `CASE` é legado descartável nem que seus dados podem ser migrados. Precisamos identificar sua finalidade antes de qualquer alteração ou exclusão.

## Tipos TypeScript

`src/types/database.ts` foi gerado diretamente a partir do projeto Supabase conectado e versionado na branch de desenvolvimento. Os clientes Supabase de navegador e servidor agora usam o tipo `Database`.

## Próximos passos seguros

1. Identificar finalidade e conteúdo de `CASE` sem expor registros sensíveis; se necessário, examinar apenas contagens e metadados agregados.
2. Definir o modelo de identidade: a tabela `tenentes` representa usuário, organização/tenant ou outra entidade? Não presumir que seja a tabela de autenticação.
3. Definir proprietário e escopo de acesso de cada caso, documento e embedding.
4. Preparar migrations versionadas para políticas RLS e privilégios mínimos, testando com usuário anônimo, autenticado e proprietário autorizado.
5. Só então implementar operações de criação, leitura, atualização e exclusão na aplicação.

## Diagnóstico reproduzível

O script `supabase/diagnostics/inspect_schema.sql` permanece disponível para repetir a inspeção. Ele consulta metadados e não executa comandos de alteração nem lê registros de negócio.
