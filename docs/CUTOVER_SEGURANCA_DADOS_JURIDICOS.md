# Cutover de segurança RLS — dados jurídicos

**Estado:** migration e testes preparados na branch de desenvolvimento. Não aplicados ao Supabase.

## Auditoria atual

A leitura direta do schema e dos Security Advisors em 03/11/2026 confirmou:
- RLS desativado em `public.tenentes`, `public.case`, `public.document` e `public.embedding`;
- RLS habilitado, sem policies, em `public."CASE"`;
- `tenentes` possui um registro legado sem proprietário técnico conhecido;
- `case`, `document` e `embedding` estão vazias;
- a tabela `CASE` maiúscula é distinta e permanece sem acesso ao cliente;
- a extensão `vector` está no schema `public`, gerando alerta separado.

**Risco:** sem RLS, as quatro tabelas expostas não têm isolamento por linha para os papéis usados pelos clientes Supabase. Não habilitar RLS isoladamente: isso bloquearia operações até existirem policies adequadas.

## Migration preparada

`supabase/migrations/20261103000300_legal_data_rls_cutover.sql`

Depende das migrations anteriores de perfis e de `case_access`. Faz o seguinte:
- adiciona `created_by_user_id` ao cadastro de pessoas sem atribuir o registro legado;
- cria `case_participants`, separando papéis jurídicos de acesso técnico;
- torna obrigatório o vínculo de documentos a processos e embeddings a documentos;
- habilita RLS em `case`, `tenentes`, `case_participants`, `document` e `embedding`;
- aplica políticas por operação e privilégios mínimos;
- reserva gravação de embeddings a processos confiáveis no servidor;
- mantém a tabela `CASE` maiúscula fechada, sem inventar sua finalidade.

## Matriz resumida

- Anônimo: sem acesso às tabelas jurídicas.
- Proprietário: leitura e edição do processo, administração de colaboradores, participantes e documentos.
- Editor: leitura/edição operacional e documentos, sem administrar acessos nem excluir documentos.
- Viewer: leitura do processo, participantes, documentos e embeddings.
- Sem vínculo: nenhum acesso, inclusive por UUID conhecido.
- Administrador da plataforma: não recebe acesso automático ao conteúdo dos processos.
- Cadastro de pessoa: criador pode editar; outros usuários só visualizam quando a pessoa está vinculada a processo acessível. O registro legado sem atribuição permanece oculto.

## Limitações e bloqueios restantes

1. Esta migration não configura `storage.objects` nem cria bucket. O Storage exige policies próprias e testes de upload/download/remoção.
2. A aplicação ainda precisa implementar fluxos server-side para gravação de embeddings, administração de acesso e operações privilegiadas.
3. A migration de propriedade anterior mantém `owner_user_id` nullable durante a transição. Antes de liberar a criação de processos em produção, validar a atribuição explícita e a restrição final NOT NULL.
4. O registro antigo de `tenentes` permanece sem atribuição; não é exposto automaticamente.
5. A tabela `CASE` permanece sem acesso até investigação de sua origem.
6. As funções `SECURITY DEFINER` e os grants precisam passar por testes comportamentais em ambiente isolado com contas distintas.

## Testes

`supabase/tests/legal_data_rls_security.sql` contém assertions estruturais e cenários manuais. A CI de frontend não executa estes testes contra PostgreSQL. Não declarar o cutover aprovado até executar os testes no Supabase de desenvolvimento.

## Não aplicado

Nenhuma DDL, policy, alteração de grants, bucket ou dado foi aplicado ao projeto Supabase principal por esta etapa.
