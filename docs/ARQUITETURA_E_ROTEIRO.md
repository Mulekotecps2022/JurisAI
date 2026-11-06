# JurisAI — Arquitetura e plano de implementação

## Objetivo

Aplicação jurídica de uso próprio e aprendizado, com padrão de qualidade profissional. O sistema não está sendo planejado para comercialização.

## Diretrizes já definidas

- Desenvolvimento na branch `work/jurisai-primeira-entrega-2026-11-02`.
- A branch `main` permanece preservada; nenhuma alteração ou merge nela sem autorização expressa.
- Implementação com máxima autonomia, reduzindo solicitações ao usuário a decisões, autorizações, credenciais e testes realmente indispensáveis.
- A validação consolidada deverá ocorrer ao final das etapas maiores, com correções dos problemas encontrados.
- O projeto EVOLUÇÃO AI é independente e permanece pausado, sem alterações.

## Arquitetura-alvo

- **Aplicação:** Next.js com TypeScript.
- **Interface:** Tailwind CSS, com layout responsivo e acessível.
- **Camada de execução/API:** Cloudflare Workers.
- **Dados:** PostgreSQL, com Supabase como plataforma de banco e autenticação.
- **Identidade e acesso:** Supabase Auth, controle de acesso por usuário e políticas no banco (RLS).
- **Arquivos:** armazenamento privado, com autorização explícita para leitura e gravação.
- **IA:** camada multimodelo, desacoplada do provedor, com registro de modelo, versão e fontes utilizadas.
- **Pesquisa semântica:** pgvector, quando o modelo de dados e a infraestrutura estiverem validados.
- **Privacidade:** minimização de dados, proteção de credenciais, trilha de auditoria e controles compatíveis com a LGPD.

## Módulos funcionais previstos

1. Gestão de usuários, perfil e permissões.
2. Painel e gestão de casos/processos.
3. Cadastro e gestão de clientes/partes.
4. Biblioteca e armazenamento de documentos.
5. Análise de documentos e processos enviados pelo usuário.
6. Pesquisa jurídica externa atualizada, priorizando fontes oficiais e referências verificáveis.
7. Assistente jurídico conversacional.
8. Elaboração e revisão de peças e documentos.
9. Investigador jurídico e organizador de evidências.
10. Verificador de fundamentos, legislação, precedentes e citações.
11. Estrategista jurídico para cenários, riscos e linhas argumentativas.

## Sequência de implementação

### Etapa 1 — Diagnóstico e estabilização do repositório
- Inventariar arquivos, dependências, configuração e serviços existentes.
- Identificar o schema real do Supabase antes de alterar consultas ou criar tabelas.
- Corrigir problemas comprovados no código atual.
- Manter as alterações isoladas na branch de trabalho.

### Etapa 2 — Fundação da aplicação
- Estruturar o projeto Next.js/TypeScript.
- Separar interface, componentes, serviços, validação e acesso a dados.
- Definir configuração por ambiente e impedir que segredos sejam incluídos no repositório.
- Preparar tratamento consistente de erros, estados de carregamento e validação de formulários.

### Etapa 3 — Identidade, dados e arquivos
- Integrar autenticação.
- Modelar banco a partir dos requisitos e do schema efetivamente disponível.
- Implementar políticas RLS e testes de isolamento entre usuários.
- Integrar armazenamento privado de documentos.

### Etapa 4 — Módulos jurídicos e IA
- Implementar gestão de casos, clientes e biblioteca.
- Integrar análise documental, assistente, elaboração e revisão.
- Integrar pesquisa externa com fontes e citações rastreáveis.
- Implementar verificação de fundamentos e trilha de auditoria.

### Etapa 5 — Implantação e validação consolidada
- Configurar implantação e variáveis de ambiente.
- Executar testes funcionais, de segurança, permissões, integração e responsividade.
- Corrigir falhas e registrar limitações conhecidas.
- Só então considerar a versão pronta para uso.

## Estado técnico verificado em 02/11/2026

- O protótipo HTML legado permanece preservado em `index.html`.
- A estrutura profissional Next.js/TypeScript/Tailwind está criada em `src/`, com configuração de ambiente e clientes Supabase de navegador/servidor.
- O schema real do projeto Supabase foi inspecionado e os tipos TypeScript foram gerados diretamente dele em `src/types/database.ts`.
- A integração de build Cloudflare Workers foi preparada com OpenNext e Wrangler.
- A CI executou com sucesso: instalação de dependências, lint, typecheck, build Next.js e build Cloudflare Workers (run 41543910251).
- O schema real, relações, contagens agregadas e alertas RLS estão documentados em `docs/DIAGNOSTICO_SUPABASE.md`.
- O significado funcional de `tenentes` foi esclarecido pelo usuário: módulo de cadastro de clientes, partes e responsáveis relacionados aos processos, não usuários nem organizações/tenants de autenticação.
- A tabela `CASE` em maiúsculas continua sem finalidade confirmada; não será apagada nem combinada com `case` por suposição.
- As operações definitivas e migrations de negócio continuam bloqueadas até o desenho das relações e políticas de acesso.
- A `main` permanece intacta; todas as alterações seguem isoladas na branch de trabalho.

## Regras de segurança e integridade

- Não presumir colunas, tabelas, políticas ou credenciais que não tenham sido verificadas.
- Chaves públicas anon do Supabase não substituem RLS; operações sensíveis devem ser protegidas no servidor e no banco.
- Nunca colocar service-role keys, tokens privados ou segredos no frontend ou no Git.
- Documentos jurídicos e dados pessoais devem ter acesso restrito, armazenamento privado e rastreabilidade.
- Pesquisa por IA não deve apresentar conteúdo gerado como fonte jurídica: cada fundamento deve apontar para a fonte consultada.
- Não fazer merge na branch principal sem autorização do usuário.


## Atualização de compatibilidade Cloudflare — 02/11/2026

A fundação passou a incluir OpenNext Cloudflare e Wrangler, com configuração em `wrangler.jsonc` e `open-next.config.ts`. O adaptador permite executar a aplicação Next.js no runtime Workers; a publicação ainda depende de autenticação Cloudflare e validação do build adaptado.

A versão mínima do Next.js foi elevada para a linha 15.5.28: além de atender ao piso de compatibilidade documentado pelo adaptador OpenNext 1.20.15 (15.5.27 ou superior), evita permanecer na versão 15.5.6 inicial, que antecede correções de segurança posteriores. A aplicação permanece em Next.js 15 por compatibilidade gradual; não se adotou um salto major sem testes.

A documentação atual da Cloudflare também apresenta vinext como caminho recomendado para novos projetos. Como a fundação já foi estabelecida em Next.js e o escopo arquitetural definido pelo projeto prevê Next.js, OpenNext foi adotado nesta fase para preservar compatibilidade com o framework escolhido. A alternativa vinext poderá ser reavaliada em uma etapa própria, mediante testes de compatibilidade dos módulos.

Referências técnicas consultadas:
- OpenNext Cloudflare: https://opennext.js.org/cloudflare
- Cloudflare Workers — OpenNext: https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
- Next.js 15.5.28: https://www.npmjs.com/package/next


## Modelo de domínio: pessoas e partes

O usuário esclareceu que o módulo legado chamado `tenentes` é destinado ao cadastro de clientes, partes envolvidas, responsáveis e outros participantes jurídicos. O nome não representa o conceito de tenant/organização nem o cadastro de usuários autenticados.

Diretriz de modelagem:
- Tratar o conceito funcional como **Pessoas e Partes**.
- Uma pessoa/entidade pode assumir mais de um papel e pode exercer papéis distintos em processos diferentes.
- Papéis iniciais previstos: cliente, parte autora, parte ré/contraparte, advogado, responsável, parceiro/colaborador e outro.
- A relação entre pessoa e processo deve ser explícita e permitir papel/contexto por processo; não reduzir todos os participantes a um único campo de texto.
- O registro legado existente em `tenentes` deve ser preservado durante a transição.
- A tabela física `tenentes` pode permanecer temporariamente por compatibilidade; eventual renomeação/migração exige plano de compatibilidade, revisão das políticas e testes.
- Usuários autenticados são uma entidade separada, vinculada ao Supabase Auth. O isolamento de dados deverá usar uma relação explícita de propriedade/acesso (por exemplo, `owner_user_id` e, se necessário, `workspace_id`), não o identificador de `tenentes`.

Não aplicar DDL até concluir o desenho de propriedade e o mapeamento de compatibilidade.


## Fundação de domínio e segurança — 02/11/2026

- Criados contratos de validação Zod para cadastro de pessoas/entidades e associação de participantes a processos em `src/features/participants/domain.ts`.
- Criados contratos de processo e papéis de acesso (`owner`, `editor`, `viewer`) em `src/features/cases/domain.ts`.
- Os papéis jurídicos (cliente, autor, réu, advogado, testemunha etc.) são separados dos papéis de autorização do usuário.
- Criado `docs/MODELO_DE_SEGURANCA.md` com desenho de identidade, propriedade, compartilhamento, RLS e Storage.
- Nenhuma operação de negócio foi conectada ao banco e nenhuma migration foi aplicada. A implementação continua protegida contra o estado atual de RLS insuficiente.


## Sessão Supabase SSR — 02/11/2026

- Variável pública padronizada para `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; não utilizar service-role/secret key no cliente.
- Criada atualização de sessão em `src/lib/supabase/middleware.ts`, invocada por `src/middleware.ts`, usando `auth.getClaims()` para validar claims e permitir renovação de sessão.
- A camada de sessão não substitui autorização. Rotas privadas e operações de dados ainda devem validar identidade e depender das políticas RLS; a página inicial permanece apenas um painel estrutural sem dados de negócio.
- Ambientes sem credenciais continuam compiláveis, mas a integração de sessão só opera depois de configurar as variáveis no ambiente de execução.


## Autenticação inicial — 02/11/2026

- Criada página `/login` com solicitação de link por e-mail via Supabase Auth.
- O fluxo usa `shouldCreateUser: false`: não há cadastro público pela interface; usuários devem ser provisionados pelo administrador do projeto.
- Criada rota `/auth/confirm` para troca segura do código PKCE por sessão, com validação de destino relativo para evitar open redirect.
- Middleware renova/valida claims da sessão e exige autenticação em /gestao e /documentos; cada API também valida a sessão e as operações do banco seguem as policies RLS.
- O Supabase Auth deve ter `/auth/confirm` e os domínios de desenvolvimento/produção configurados na allow list de Redirect URLs.

- A tela de login usa mensagem genérica para não revelar se um e-mail existe; o callback valida a origem do redirecionamento para evitar open redirect.


## Estado de integração — 04/11/2026

- Supabase de desenvolvimento com migrations de perfil, propriedade, RLS, Storage, índices de FK e campos de contato de pessoas aplicadas.
- Todas as 12 FKs auditadas possuem índices de suporte.
- Rotas /gestao e /documentos protegidas por sessão; APIs de pessoas e processos passam por Supabase Auth e RLS.
- Workspace de gestão conectado às APIs de pessoas/processos; o cadastro de pessoas e a criação de processos deixam de ser dados fictícios.
- Tipos TypeScript regenerados diretamente a partir do schema real do Supabase.
- Testes SQL estruturais e multiusuário passaram no PostgreSQL descartável; o workflow mais recente ainda precisa concluir os builds finais.
- O Supabase de desenvolvimento está sem usuários Auth; login real depende do convite e promoção da conta inicial.
- A biblioteca de documentos continua demonstrativa. Upload permanece em quarentena até integração de scanner antimalware.
- PR #1 continua em rascunho para validação; não mesclar. A branch segue divergente da main.
- Produção e EVOLUÇÃO AI permanecem fora do escopo e sem alterações.


## Retificação de estado — 04/11/2026, 16:50 UTC

Esta seção é a referência mais recente e substitui afirmações históricas anteriores deste documento que indiquem que as migrations não foram aplicadas, que não há conta Auth ou que o workspace/documentos ainda usam somente dados demonstrativos.

- As sete migrations abaixo estão aplicadas no projeto Supabase `JurisAI-Desenvolvimento`: `20261103014955`, `20261103015008`, `20261103015013`, `20261103015018`, `20261103015107`, `20261104161807` e `20261104162829`.
- A identidade administrativa inicial aceitou o convite, confirmou o e-mail, recebeu perfil pelo trigger e foi promovida para `platform_admin` no ambiente de desenvolvimento.
- Teste SQL sob o papel `authenticated` confirmou `is_platform_admin() = true`; a conta não recebeu acesso implícito a processos, documentos ou embeddings.
- `anon` não possui SELECT nas tabelas de perfis, processos e documentos. O cliente autenticado não pode alterar `platform_role`, inserir/apagar perfis, apagar processos ou inserir embeddings.
- Rotas de pessoas e processos usam sessão Supabase Auth e RLS; o workspace carrega e persiste dados por essas APIs.
- A rota de consulta de documentos usa sessão e RLS. Upload permanece desabilitado na UI e na API enquanto não houver scanner antimalware e inspeção estrutural.
- GitHub Actions run `41870127147` terminou com sucesso nos dois jobs: auditoria de dependências, lint, TypeScript, testes de contrato, build Next.js, build Cloudflare e testes SQL multiusuário.
- A validação de login via navegador, cookies e sessão na aplicação hospedada ainda não foi realizada; a validação SQL não substitui esse teste.
- Os nomes/timestamps locais dos arquivos de migrations ainda precisam ser reconciliados com as versões remotas antes de automatizar `db push`.
- O PR #1 continua draft, não mesclado. A divergência com `main` permanece pendente de revisão. Produção e EVOLUÇÃO AI seguem sem alterações.

### Próximos passos

1. Validar o login real na aplicação de desenvolvimento e a sessão SSR.
2. Executar testes end-to-end com usuários distintos para owner/editor/viewer e usuário sem vínculo.
3. Integrar scanner antimalware e análise estrutural antes de liberar upload/download de documentos.
4. Alinhar os arquivos de migration com o histórico remoto antes de qualquer automação de deploy.
5. Validar Cloudflare deployment e smoke tests no ambiente de desenvolvimento.


## Reconciliação do histórico de migrations — 04/11/2026

Os sete arquivos em `supabase/migrations/` foram renomeados atomicamente na branch de trabalho para corresponder exatamente às sete versões já registradas no Supabase `JurisAI-Desenvolvimento`. Os conteúdos SQL não foram alterados nesta operação. A listagem posterior confirmou correspondência de todas as sete versões.

**Importante:** esta reconciliação de nomes não executou `db push`, não aplicou DDL adicional e não altera produção. Antes de automatizar qualquer deploy, ainda é necessário executar uma verificação de status/dry-run com a versão apropriada do Supabase CLI e revisar o resultado.
