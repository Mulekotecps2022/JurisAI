# Modelo de segurança e autorização — JurisAI

## Objetivo

Definir a fronteira entre identidade, pessoas/partes do processo e autorização de acesso aos dados jurídicos. Este documento é um plano técnico; não executa nem representa uma migration já aplicada.

## Três conceitos diferentes

1. **Usuário autenticado:** identidade em `auth.users`, gerenciada pelo Supabase Auth.
2. **Pessoa/entidade jurídica:** cadastro de cliente, parte, advogado, testemunha, responsável ou parceiro. A tabela legada `public.tenentes` pertence a este domínio.
3. **Papel de acesso:** permissão que um usuário autenticado possui sobre um processo (`owner`, `editor`, `viewer`). Não deve ser confundido com o papel jurídico da pessoa no processo.

## Relações conceituais propostas

- `auth.users` 1:1 `app_profiles` (perfil de aplicação, se necessário).
- `case` N:1 proprietário em `owner_user_id`.
- `case_access`: usuários adicionais autorizados em cada processo, com papel de acesso.
- `tenentes`: cadastro legado de pessoas/entidades.
- `case_participants`: vínculo N:N entre `case` e `tenentes`, com papel jurídico e observações por processo.
- `document` pertence a um `case`; `embedding` pertence a um `document`.

O modelo permite que uma mesma pessoa tenha papéis diferentes em processos diferentes e que um processo tenha múltiplos participantes.

## Regras de autorização pretendidas

- Acesso anônimo (`anon`) a dados jurídicos deve ser negado.
- Usuário autenticado só pode ler um processo se for seu proprietário ou possuir vínculo autorizado em `case_access`.
- `owner` pode administrar participantes, documentos e permissões do processo.
- `editor` pode operar os dados permitidos no processo, sem administrar o proprietário ou conceder acesso de proprietário.
- `viewer` tem acesso somente de leitura.
- A leitura/gravação de documentos e embeddings deve herdar a autorização do processo associado.
- O cadastro de pessoas deve ser visível somente ao usuário que o criou ou a usuários com acesso a pelo menos um processo que relacione aquela pessoa, conforme regra final a ser validada.
- A tabela legada `tenentes` não pode ser usada como substituta de `auth.users` nem como chave de isolamento.
- O registro legado existente em `tenentes` não pode ser descartado. Como não possui proprietário associado, sua atribuição deverá ser definida antes de liberar o acesso protegido a esse cadastro.

## Privilégios e RLS

A auditoria de 02/11/2026 encontrou privilégios amplos para `anon` e `authenticated`, RLS desabilitado em quatro tabelas e RLS sem políticas na tabela `CASE`. Antes de habilitar RLS em produção, a migration deverá:

1. Definir e testar funções auxiliares de autorização com `SECURITY DEFINER`, `search_path` fixo e referências qualificadas, evitando recursão entre políticas.
2. Habilitar RLS em todas as tabelas expostas.
3. Criar políticas explícitas de SELECT/INSERT/UPDATE/DELETE com verificação de proprietário ou vínculo de acesso.
4. Revogar privilégios de `anon` nas tabelas jurídicas e conceder a `authenticated` somente operações necessárias.
5. Manter `service_role` exclusivamente em ambiente confiável de servidor, nunca no navegador.
6. Cobrir as políticas com testes para usuário anônimo, usuário sem vínculo, proprietário, editor e viewer.
7. Verificar também Storage: buckets privados, políticas por processo e URLs assinadas de curta duração.

A tabela `CASE` em maiúsculas permanece fora do fluxo funcional até que sua finalidade seja esclarecida. Não copiar nem apagar dados dessa tabela por suposição.

## Sequência de implantação segura

1. Confirmar a conta Supabase Auth que será usada como primeiro proprietário administrativo.
2. Criar migrations aditivas e reversíveis em ambiente de desenvolvimento/branch isolada.
3. Atribuir explicitamente o registro legado de `tenentes` ao contexto autorizado, sem expor dados.
4. Testar RLS e operações com múltiplas identidades.
5. Só depois aplicar o plano ao projeto principal, com backup e autorização apropriada.

**Status:** desenho documentado; nenhuma alteração de banco foi executada nesta etapa.


## Auditoria atualizada — 03/11/2026

A auditoria direta confirmou RLS desativado em `tenentes`, `case`, `document` e `embedding`; `CASE` (maiúscula) está com RLS ligado e sem policies. As quatro tabelas sem RLS constituem um risco crítico de exposição via papéis cliente. A correção deve ser coordenada com policies e grants completos; não habilitar RLS isoladamente.

Foi preparada a migration `20261103000300_legal_data_rls_cutover.sql`, ainda não aplicada, para proteger processos, cadastro de pessoas, participantes jurídicos, documentos e embeddings. O registro legado de `tenentes` permanece sem criador atribuído e, portanto, oculto. A tabela `CASE` permanece fechada até esclarecer sua finalidade.

O Storage continua pendente de bucket privado e policies próprias. Testes estruturais e comportamentais em ambiente Supabase isolado são obrigatórios. Nenhuma alteração foi aplicada ao projeto principal.


## Upload e download privados

A migration preparatória `20261103000400_private_document_storage.sql` configura o bucket privado e remove escrita direta do navegador em metadados e objetos. O endpoint server-side verifica identidade e papel owner/editor antes de usar uma chave privilegiada mantida apenas no ambiente do servidor, revalidando o acesso depois da gravação.

Todo objeto começa em quarentena. A policy de Storage permite leitura apenas para documentos com status `available` e usuário com acesso ao processo. O endpoint de download gera signed URL de 5 minutos, sem cache, somente após RLS permitir a leitura.

Não há scanner antimalware integrado nesta etapa. Portanto, o sistema não libera arquivos automaticamente; a inspeção de assinatura é preliminar e insuficiente para declarar um arquivo seguro. A credencial privilegiada não pode ser configurada em variável `NEXT_PUBLIC_*`, commit, issue ou log.
