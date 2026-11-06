# Upload seguro e Storage privado — JurisAI

**Estado em 04/11/2026:** migrations de segurança e Storage aplicadas no Supabase `JurisAI-Desenvolvimento`. Bucket privado criado. Nenhuma alteração em produção; nenhum documento real enviado.

## Decisão de segurança

O bucket `case-documents` é privado, com limite de 25 MiB e allowlist MIME. O navegador não possui policies de leitura ou escrita em `storage.objects`. Upload e assinatura de URLs são feitos por rotas server-side com chave secreta, depois de validar identidade e autorização de processo.

## Upload

`POST /api/documentos/upload`:
- exige sessão válida;
- verifica proprietário/editor através de consultas RLS;
- verifica tamanho, MIME, extensão e assinatura preliminar;
- calcula SHA-256;
- cria metadados com status `quarantined`;
- grava o objeto em caminho opaco;
- revalida a autorização após a gravação;
- não retorna URL pública ou signed URL.

## Download corrigido

`GET /api/documentos/[documentId]/download`:
- exige sessão válida;
- lê metadados através do cliente do usuário, com RLS;
- bloqueia status diferente de `available`;
- usa o cliente administrativo server-only exclusivamente para gerar a URL assinada de 300 segundos;
- responde com redirecionamento e cabeçalhos `no-store`.

Essa separação é necessária porque Storage não tem policy de navegador. Não conceder policy ampla só para fazer o download funcionar. Um link previamente assinado continua válido até expirar; a revogação bloqueia novas assinaturas, não invalida retroativamente o link emitido.

## Quarentena obrigatória

Não existe scanner antimalware integrado. Os arquivos devem permanecer em `quarantined`; não promover a `available` manualmente e não liberar downloads até que exista verificação confiável. Magic bytes e MIME não substituem antivírus, inspeção estrutural OOXML, proteção contra ZIP bombs ou sandbox.

## Segredos

Configurar apenas no ambiente seguro de servidor:
- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
- `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY` legado).

A chave secreta nunca deve ser versionada ou exposta em `NEXT_PUBLIC_*`.

## Proteção das rotas e estado da interface

As rotas de gestão e documentos exigem sessão autenticada via middleware. O fluxo de magic link mantém o destino relativo solicitado e o callback rejeita redirecionamento para outra origem.

A página `/documentos` e o workspace de gestão ainda usam dados demonstrativos em memória. Não estão conectados ao banco nem ao endpoint de upload; a autenticação protege o acesso à tela, mas ainda não existe persistência funcional de negócio.

## Critérios antes de produção

1. CI verde confirmado por logs.
2. Testes reais com owner/editor/viewer/usuário sem acesso/anon.
3. Scanner antimalware e fluxo de quarentena implementados.
4. Secrets de Cloudflare configurados sem exposição.
5. Upload, download, expiração e revogação testados.
6. Rate limit, observabilidade e logs sem conteúdo sensível.
7. Interface conectada aos dados reais e revisada contra exposição de dados.

Produção permanece intocada.
