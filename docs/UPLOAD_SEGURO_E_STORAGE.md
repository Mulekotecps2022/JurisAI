# Upload seguro e Storage privado — JurisAI

**Estado:** migration e endpoint preparados na branch de desenvolvimento. Não implantados no Supabase nem no Cloudflare.

## Decisão de segurança

O bucket `case-documents` é privado. A gravação de metadados e arquivos é feita exclusivamente por endpoint server-side usando uma chave secreta que nunca chega ao navegador. O endpoint valida a sessão Supabase e confirma proprietário/editor do processo antes de usar a credencial privilegiada.

A chave de servidor é um segredo de alto impacto: deve ser configurada apenas no ambiente de servidor (Cloudflare Worker secret / ambiente de execução), nunca em `NEXT_PUBLIC_*`, GitHub ou arquivo versionado.

## Migration

`supabase/migrations/20261103000400_private_document_storage.sql`

- cria/valida bucket privado com limite 25 MiB e allowlist MIME;
- adiciona metadados de armazenamento, hash SHA-256 e estado de quarentena;
- remove gravação direta do navegador em `public.document` e `storage.objects`;
- permite leitura de objetos somente quando o documento está `available` e o usuário tem acesso ao processo;
- não permite overwrite/replace por cliente;
- não expõe arquivo recém-enviado antes de uma etapa confiável de inspeção.

Se um bucket de mesmo nome existir com configuração divergente, a migration aborta em vez de torná-lo público ou alterar suas restrições silenciosamente.

## Endpoint

`POST /api/documentos/upload` recebe multipart com `caseId` e `file`.
- exige sessão válida;
- verifica owner/editor via políticas do banco e membership;
- verifica tamanho, MIME, extensão e assinatura/magic bytes suportada;
- calcula SHA-256;
- cria registro com status `quarantined`;
- grava em caminho opaco `<case UUID>/<document UUID>/original.<ext>`;
- não retorna URL pública nem signed URL;
- mantém registro de falha com status `upload_failed` se a gravação falhar.

Formatos DOCX/XLSX são contêineres ZIP: a assinatura PK inicial é apenas uma verificação preliminar, não comprova estrutura OOXML válida nem segurança do conteúdo.

## Quarentena é obrigatória

A inspeção preliminar não substitui antivírus, análise de ZIP bombs, validação estrutural de documentos, OCR isolado ou sandbox. Não existe ainda scanner integrado. Por isso, os arquivos ficam em `quarantined` e a policy de Storage não permite download nem signed URL enquanto não forem liberados por processo confiável.

## Dependências operacionais

Configurar no ambiente de servidor:
- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
- `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY` legado), como secret privado.

Não adicionar a chave secreta ao repositório. Não foi configurada nem testada no ambiente Cloudflare.

## Testes e limites

`supabase/tests/private_document_storage.sql` verifica estrutura, bucket, grants e policy. Testes comportamentais precisam de contas owner/editor/viewer/usuário externo e de um ambiente isolado.

A rota não deve ser considerada produção pronta até que:
1. as migrations 001–004 tenham sido aplicadas e testadas em ambiente de desenvolvimento isolado;
2. a secret esteja configurada em ambiente seguro;
3. scanner/antimalware e worker de quarentena existam;
4. signed URL curta (5 minutos) seja implementada somente após status `available`;
5. limites de requisição/rate limit, logs sem conteúdo sensível e observabilidade estejam validados.

**Nenhuma alteração foi aplicada ao banco principal, nenhum bucket foi criado no projeto ativo e nenhum arquivo real foi enviado.**
