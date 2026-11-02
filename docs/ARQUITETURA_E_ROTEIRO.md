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

- A branch de trabalho contém atualmente `index.html` e `README.md`; o README estava vazio.
- A página atual é um protótipo HTML com cliente Supabase no navegador.
- O arquivo contém referências às tabelas `tenentes` e `case`, mas a estrutura real dessas tabelas ainda não foi confirmada.
- Não foram localizados, na raiz da branch, arquivos de migração, configuração Supabase, pacote Next.js ou testes automatizados.
- Correções recentes no protótipo: escape de mensagens e títulos antes da renderização; padronização da tabela `case`; datas em localidade `pt-BR`.
- Ainda não foi comprovado o funcionamento em navegador nem a integração real com o Supabase.

## Regras de segurança e integridade

- Não presumir colunas, tabelas, políticas ou credenciais que não tenham sido verificadas.
- Chaves públicas anon do Supabase não substituem RLS; operações sensíveis devem ser protegidas no servidor e no banco.
- Nunca colocar service-role keys, tokens privados ou segredos no frontend ou no Git.
- Documentos jurídicos e dados pessoais devem ter acesso restrito, armazenamento privado e rastreabilidade.
- Pesquisa por IA não deve apresentar conteúdo gerado como fonte jurídica: cada fundamento deve apontar para a fonte consultada.
- Não fazer merge na branch principal sem autorização do usuário.
