# Armazenamento privado de documentos — JurisAI

**Estado atualizado em 04/11/2026:** migrations de segurança e Storage aplicadas no projeto Supabase de desenvolvimento `JurisAI-Desenvolvimento` (`qvmkafixxfahabcgtlgz`). O bucket `case-documents` existe e está privado. Produção permanece inalterada.

## Diagnóstico histórico — 02/11/2026

A primeira inspeção encontrou as tabelas públicas sem RLS (exceto `CASE`, que já tinha RLS sem policy), nenhum bucket e nenhum histórico de migrations. Esse diagnóstico descreve o estado anterior às migrations e não o estado atual.

## Configuração atual

- Bucket privado: `case-documents`.
- Limite máximo: 25 MiB por arquivo.
- MIME allowlist: PDF, JPEG, PNG, TIFF, DOC/DOCX, XLS/XLSX, TXT e EML.
- Chaves de objeto opacas no formato `<case_uuid>/<document_uuid>/original.<ext>`.
- Metadados em `public.document`, com hash SHA-256 e estado.
- Estado inicial de cada upload: `quarantined`.
- Sem policy de acesso Storage direta para `anon` ou `authenticated`; o navegador não pode enviar nem ler objetos diretamente.

## Fluxo de upload

`POST /api/documentos/upload`:
1. valida origem e conteúdo multipart;
2. valida UUID do processo, tamanho, nome, extensão e MIME;
3. valida sessão com `auth.getUser()`;
4. verifica proprietário/editor por consultas protegidas por RLS;
5. verifica assinatura preliminar do arquivo e calcula SHA-256;
6. grava metadados e objeto por cliente administrativo server-only;
7. revalida acesso após o upload e remove/bloqueia o objeto se o acesso tiver sido revogado.

A rota não retorna URL pública nem link de download. Os arquivos são mantidos em quarentena.

## Fluxo de download

`GET /api/documentos/[documentId]/download`:
1. valida UUID e sessão;
2. consulta metadados usando o cliente do usuário, de modo que RLS comprove acesso ao processo;
3. bloqueia qualquer registro cujo estado não seja `available`;
4. somente depois usa cliente administrativo server-only para assinar URL por 300 segundos;
5. redireciona sem armazenar a URL assinada.

A assinatura privilegiada é necessária porque o Storage foi intencionalmente mantido sem policies de navegador. Um link assinado já emitido pode permanecer válido até o fim dos cinco minutos, mesmo após uma revogação; a revogação impede novas assinaturas.

## Bloqueador de segurança

Não existe scanner antimalware integrado. Portanto:
- o status permanece `quarantined`;
- a rota de download não libera arquivos;
- não promover manualmente arquivos para `available`;
- não usar documentos reais até integração de scanner/inspeção isolada.

A assinatura de magic bytes e o MIME são verificações preliminares, não certificação de segurança. DOCX/XLSX exigem inspeção estrutural de ZIP/OOXML e proteção contra arquivos maliciosos/ZIP bombs.

## Segredos e implantação

O cliente administrativo importa `server-only` e aceita `SUPABASE_SECRET_KEY` (ou a variável legada `SUPABASE_SERVICE_ROLE_KEY`) apenas no servidor. Essa secret nunca pode ir ao navegador, a `NEXT_PUBLIC_*` ou a arquivos versionados.

A configuração e o deploy no Cloudflare ainda precisam ser validados. A página `/documentos` continua demonstrativa, com dados fictícios em memória; não confundir a tela com integração de upload real.

## Testes pendentes

- Execução verde do GitHub Actions confirmada por logs dos jobs.
- Auth real com contas distintas.
- Upload com owner/editor e negação para viewer/usuário sem vínculo/anon.
- Quarentena e bloqueio de download.
- Emissão de URL assinada apenas após liberação confiável.
- Expiração de 300 segundos e revogação para novas assinaturas.
- Scanner antimalware e fluxo de rejeição/limpeza.
- Secrets, deployment e smoke tests no Cloudflare.

**Produção permanece intocada. Nenhum documento real foi enviado.**
