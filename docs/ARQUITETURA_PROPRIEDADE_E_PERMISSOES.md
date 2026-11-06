# Arquitetura de propriedade de processos e permissões

**Estado:** arquitetura documentada e migrations preparatórias versionadas na branch de desenvolvimento; nenhuma migration foi aplicada ao banco principal. A estrutura preparatória de `case_access` tem RLS próprio, mas as tabelas jurídicas existentes ainda não estão protegidas por uma política completa.

## 1. Objetivo e princípios

Estabelecer uma fronteira verificável entre identidade autenticada, propriedade do processo, colaboração e participação jurídica. Toda autorização deve ser aplicada no PostgreSQL por RLS e, no Storage, pelas policies de `storage.objects`; esconder botões na interface não é controle de segurança.

Princípios:
- negar por padrão: sem sessão válida e sem vínculo explícito, não há acesso;
- menor privilégio: conceder apenas as operações necessárias;
- isolamento por processo: documentos, metadados e embeddings herdam a autorização do processo;
- separar pessoa/parte jurídica de usuário autenticado;
- registrar concessões, revogações, transferências e operações sensíveis em trilha de auditoria;
- não atribuir automaticamente registros legados a uma conta;
- não colocar `service_role` em navegador, código público ou variáveis `NEXT_PUBLIC_*`.

## 2. Entidades e relações propostas

### Identidade
- `auth.users.id` é a identidade técnica e a origem de `auth.uid()`.
- `app_user_profiles` é opcional nesta primeira implementação; pode guardar nome de exibição e preferências, mas nunca substituir `auth.users`.
- O login atual usa link por e-mail e `shouldCreateUser: false`, portanto contas devem ser provisionadas previamente.

### Processo e propriedade
- Adicionar `owner_user_id uuid` em `public.case`, referenciando `auth.users(id)`. Na fase preparatória a coluna é nullable para não atribuir proprietário por suposição; deverá tornar-se NOT NULL somente na migração coordenada que validar e tratar todos os registros legados.
- O proprietário é único e explícito. Não inferir propriedade a partir de `tenente_id`, e-mail, primeiro login ou ordem de criação.
- A propriedade não será duplicada como papel `owner` em uma tabela de membros. Isso evita duas fontes de verdade.

### Compartilhamento
Criar `public.case_access` para usuários adicionais:
- `case_id uuid NOT NULL` → `public.case(id)`;
- `user_id uuid NOT NULL` → `auth.users(id)`;
- `role text NOT NULL CHECK (role IN ('editor','viewer'))`;
- `granted_by uuid NOT NULL` → `auth.users(id)`;
- `created_at timestamptz NOT NULL`;
- chave primária ou unicidade para o par (`case_id`, `user_id`).

Somente o proprietário pode conceder, alterar ou revogar acesso de colaboradores. Não permitir que usuário conceda acesso a si próprio. Transferência de propriedade será operação explícita, autenticada e auditada; não será um UPDATE comum de cliente.

### Pessoas e participantes jurídicos
- `public.tenentes` continua sendo o cadastro de pessoas físicas/jurídicas, clientes, partes, advogados, testemunhas e demais envolvidos.
- Criar `public.case_participants` ligando `case_id` a `tenentes.id`, com `role` jurídico e observações específicas daquele processo.
- Papéis jurídicos iniciais: `client`, `plaintiff`, `defendant`, `lawyer`, `responsible`, `partner`, `witness`, `expert`, `other`.
- Esses papéis não concedem acesso técnico. Uma testemunha não vira `viewer); um advogado cadastrado não vira `editor` automaticamente.
- A visibilidade de dados pessoais deve ser limitada ao criador autorizado e aos usuários com acesso a processo que justifique a consulta. Não expor a lista global de pessoas nem associações com processos inacessíveis.
- A política de compartilhamento/reutilização do cadastro de pessoa será testada para impedir vazamento lateral entre processos.

### Documentos e IA
- `document.case_id` identifica o processo ao qual o documento pertence.
- `embedding.document_id` deriva a autorização do documento e do processo; não haverá leitura direta de embeddings por usuários sem acesso ao processo.
- Documentos sem `case_id` não poderão ser enviados ao Storage privado como documentos jurídicos.
- Buckets privados e policies de Storage deverão consultar o vínculo de acesso ao processo; não confiar somente no prefixo da pasta ou em `bucket_id`.

## 3. Matriz de permissões pretendida

| Ação | Proprietário | Editor | Viewer | Sem vínculo / anon |
|---|---:|---:|---:|---:|
| Listar/ler processo | Sim | Sim | Sim | Não |
| Alterar título/descrição e dados operacionais | Sim | Sim | Não | Não |
| Ler documentos do processo | Sim | Sim | Sim | Não |
| Enviar novo documento | Sim | Sim | Não | Não |
| Substituir/renomear documento | Sim | Sim, conforme política de versão | Não | Não |
| Excluir documento | Sim | Não por padrão | Não | Não |
| Ler resultados/embeddings de IA | Sim | Sim | Sim, leitura | Não |
| Gerar análise/novo conteúdo de IA | Sim | Sim | Não | Não |
| Conceder/revogar colaboradores | Sim | Não | Não | Não |
| Transferir propriedade | Somente fluxo explícito | Não | Não | Não |
| Excluir processo | Somente fluxo explícito com confirmação/auditoria | Não | Não | Não |

A matriz é uma base conservadora. Permissões mais finas podem ser adicionadas sem confundir papéis jurídicos com papéis de acesso.

## 4. Regras RLS e privilégios

A futura implementação deverá:
1. revogar privilégios desnecessários de `anon` nas tabelas jurídicas;
2. conceder a `authenticated` somente SELECT/INSERT/UPDATE/DELETE necessários, mantendo privilégios administrativos fora do cliente;
3. habilitar RLS em `case`, `case_access`, `tenentes`, `case_participants`, `document` e `embedding`;
4. usar políticas específicas por operação, com verificação do proprietário ou de `case_access`;
5. usar funções auxiliares cuidadosamente revisadas quando necessário para evitar recursão entre policies; qualquer função `SECURITY DEFINER` deverá ter `search_path` fixo, referências qualificadas e EXECUTE restrito;
6. validar `WITH CHECK` em INSERT/UPDATE para impedir troca de `case_id`, `owner_user_id`, `user_id` ou campos de autorização pelo cliente;
7. impedir que a policy de `case_access` permita autoelevação, autoconcessão ou que editor convide outros;
8. manter acesso administrativo por `service_role` apenas em ambiente confiável de servidor e com uso mínimo;
9. aplicar controle equivalente às tabelas e objetos do Storage.

Não usar policies genéricas como `auth.uid() IS NOT NULL`, nem confiar em ID de pasta enviado pelo navegador como prova de autorização.

## 5. Migração e dados legados

Diagnóstico confirmado em 02/11/2026:
- `public.case` tem zero registros;
- `public.document` tem zero registros;
- `public.embedding` tem zero registros;
- `public.tenentes` tem um registro, que deve ser preservado;
- não há migrations registradas;
- `public.CASE` (maiúscula) é tabela distinta, vazia, com `id bigint`, `created_at` e `Name`; não foi encontrada finalidade comprovada;
- o login da aplicação não cria contas automaticamente.

Plano de migração:
1. identificar a finalidade de `public.CASE` por histórico de origem, metadados e referências; não renomear, mesclar ou excluir nesta fase;
2. confirmar qual conta existente em `auth.users` será o primeiro proprietário administrativo;
3. criar estrutura aditiva e índices para propriedade/acesso/participantes; (migration preparatória já versionada, ainda não aplicada)
4. preservar o registro de `tenentes` e atribuir visibilidade somente depois de decisão explícita; não assumir que pertence ao primeiro usuário;
5. tornar `case.owner_user_id` obrigatório antes de habilitar criação de processos;
6. aplicar RLS e privilégios em migration versionada, com rollback documentado;
7. testar as policies com pelo menos duas contas distintas e uma sessão anônima;
8. só então criar bucket privado e policies de Storage.

Como as tabelas `case`, `document` e `embedding` estão vazias, a inclusão de propriedade pode ser simples nelas, mas o cadastro legado `tenentes` requer decisão específica. Não preencher owner com valor presumido.

## 6. Testes obrigatórios antes de dados reais

- anon: nenhuma leitura ou escrita em tabelas jurídicas ou Storage;
- usuário A: cria processo e torna-se proprietário;
- usuário B sem vínculo: não lista nem acessa o processo, seus documentos ou embeddings, mesmo conhecendo UUIDs;
- editor B: pode operar apenas o processo compartilhado e não pode conceder acesso, transferir propriedade ou excluir processo;
- viewer C: somente leitura, inclusive downloads autorizados;
- revogação: após remover vínculo, o usuário perde acesso em novas requisições e não consegue gerar nova URL assinada;
- isolamento: trocar `case_id`, `document_id`, caminho do Storage ou metadados no cliente não permite atravessar processos;
- pessoas: um participante de um processo não revela contatos nem vínculos de outros processos inacessíveis;
- IA: consultas vetoriais e resultados de análise sempre filtrados por processos autorizados;
- regressão: login, renovação de sessão, lint, TypeScript, build Next.js e build Cloudflare.

## 7. Bloqueios e decisões

- O registro existente em `tenentes` não tem proprietário técnico conhecido; deve permanecer sem atribuição até confirmação.
- A finalidade da tabela `CASE` (maiúscula) ainda não foi comprovada.
- A conta inicial proprietária precisa ser identificada no Supabase Auth antes da primeira migration de propriedade.
- Não foi aplicada nenhuma mudança no Supabase nesta etapa.

## 8. Critério de liberação de uploads

Uploads reais só serão habilitados quando: propriedade e compartilhamento estiverem aplicados; RLS e grants estiverem revisados; Storage privado estiver configurado; testes anon/sem acesso/owner/editor/viewer passarem; e validação de conteúdo, auditoria e tratamento de arquivos estiverem implementados.

**Status final:** arquitetura proposta e documentada. Banco, policies e Storage permanecem inalterados.

## 10. Cutover RLS dos dados jurídicos

A auditoria direta do projeto em 03/11/2026 confirmou RLS desativado em `tenentes`, `case`, `document` e `embedding`, e RLS habilitado sem policies em `CASE` (maiúscula). Esse alerta é crítico: não há isolamento por linha nas quatro tabelas expostas. Não habilitar RLS isoladamente, pois sem policies isso bloquearia operações.

Foi preparada, mas não aplicada, a migration `supabase/migrations/20261103000300_legal_data_rls_cutover.sql`, com testes em `supabase/tests/legal_data_rls_security.sql`. Ela:
- habilita RLS e políticas por operação em processos, pessoas, participantes, documentos e embeddings;
- separa participantes jurídicos de colaboradores técnicos;
- restringe embeddings a leitura autenticada autorizada, reservando escrita ao servidor;
- impede alterar proprietário do processo e mover documentos entre processos pelo cliente;
- mantém o registro legado de pessoa sem criador atribuído oculto;
- mantém a tabela `CASE` sem acesso ao cliente até esclarecer sua finalidade.

**Limite:** o Storage ainda exige bucket privado e policies próprias. A migration também depende das duas migrations anteriores de perfil e acesso. A execução de testes estruturais e comportamentais em ambiente Supabase isolado é obrigatória antes de qualquer cutover de produção.

## 11. Administrador inicial da plataforma

A conta inicial indicada pelo responsável pelo projeto foi localizada em `auth.users`, com convite concluído, e-mail confirmado e primeiro acesso registrado. O endereço e o UUID não são reproduzidos nesta documentação para evitar expor identificadores pessoais.

A indicação da conta como **administrador inicial da plataforma** é uma decisão de provisionamento, distinta da propriedade de processos. Antes de persistir essa função em banco, a implementação deverá:

- criar/definir um perfil de aplicação (`app_user_profiles`) vinculado 1:1 a `auth.users.id`, com papel de plataforma explícito e restrito;
- atribuir o papel inicial de administrador somente à conta confirmada pelo responsável, por migration/bootstrap auditável e idempotente;
- impedir que usuários alterem o próprio papel ou promovam outras contas pelo cliente;
- manter a administração da plataforma separada da propriedade de processos (`case.owner_user_id`) e dos papéis de colaboração (`case_access`);
- não conceder acesso automático ao conteúdo de processos, documentos ou embeddings apenas por ser administrador da plataforma. A leitura desses dados continuará exigindo propriedade ou vínculo de acesso, salvo fluxo administrativo excepcional, justificado e auditado;
- executar operações privilegiadas de provisionamento exclusivamente no servidor, com credencial administrativa fora do navegador.

**Estado atual:** identidade autenticada e confirmada; conta indicada para o primeiro papel administrativo. O papel ainda não foi gravado em tabela de aplicação, nenhuma migration foi aplicada e nenhuma permissão de dados jurídicos foi ampliada.


## 12. Storage privado e upload em quarentena

Foi preparada a migration `20261103000400_private_document_storage.sql`, dependente das migrations 001–003. Ela cria/valida bucket privado `case-documents` (25 MiB, allowlist MIME), acrescenta metadados e estado de quarentena, restringe gravações ao servidor e só permite leitura do objeto quando o documento está `available` e o usuário tem acesso ao processo.

A rota `POST /api/documentos/upload` autentica o usuário, confirma proprietário/editor, valida tamanho, extensão, MIME e assinatura preliminar, calcula SHA-256 e grava via credencial privilegiada exclusivamente server-side. A rota de download cria URL assinada de 5 minutos somente para documento liberado e autorizado.

**Bloqueio deliberado:** ainda não há antimalware/scanner integrado. Portanto, todo arquivo permanece em `quarantined`; não há download ou URL assinada. A checagem de magic bytes não é certificação de segurança, especialmente para DOCX/XLSX. O endpoint falha fechado se a secret de servidor não estiver configurada.

A migration, endpoint, testes e documentação estão apenas na branch de desenvolvimento. Nenhuma alteração foi aplicada ao Supabase principal e nenhum deploy foi realizado.
