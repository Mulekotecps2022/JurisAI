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
