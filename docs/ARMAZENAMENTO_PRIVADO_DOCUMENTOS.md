# Armazenamento privado de documentos — plano de segurança

**Estado:** desenho técnico preparado; nenhuma bucket, policy ou migration foi criada nesta etapa.

## Diagnóstico do projeto em 02/11/2026

A inspeção direta do projeto Supabase `vwqzrhybemvhqsbsbfjp` encontrou:

- Schema `storage` ativo e tabelas gerenciadas pelo Supabase.
- Nenhum bucket em `storage.buckets`.
- Nenhuma policy em `pg_policies` para `storage.objects` ou tabelas públicas.
- RLS habilitado em `storage.objects`, mas sem policies explícitas.
- Privilégios SQL de `anon` e `authenticated` presentes em `storage.objects`; isso não substitui as policies RLS.
- As tabelas públicas `case`, `document`, `embedding` e `tenentes` continuam com RLS desabilitado; `CASE` tem RLS habilitado sem policy.

A documentação oficial do Supabase confirma que buckets privados dependem de policies em `storage.objects`, e que downloads de buckets privados exigem autorização ou URL assinada com prazo limitado. Um bucket privado sem policies não permite uploads, o que é o comportamento seguro padrão.

## Decisões técnicas propostas

1. Bucket único privado: `case-documents`; nunca público.
2. Limite inicial por arquivo: 25 MiB, sujeito a ajuste após testes.
3. Tipos aceitos inicialmente: PDF, JPEG, PNG, TIFF, DOC/DOCX, XLS/XLSX, TXT e EML. SVG, HTML, executáveis e arquivos compactados ficam bloqueados.
4. Caminho opaco por processo e documento: `<case_uuid>/<document_uuid>/original.<ext>`. O nome original permanece nos metadados, não no caminho físico.
5. Upload/download sempre autenticado, com autorização verificada no banco para o processo relacionado.
6. URLs assinadas somente quando necessárias, com expiração curta (proposta inicial: 5 minutos); nunca persistir URLs assinadas no banco.
7. Não usar `service_role` no navegador. Preferir JWT do usuário e policies RLS; qualquer operação privilegiada fica restrita a servidor confiável.
8. Validar tamanho, extensão, MIME declarado e assinatura real do conteúdo no servidor. MIME informado pelo navegador não é prova suficiente.
9. Calcular hash SHA-256, registrar auditoria e tratar o arquivo como não confiável até passar por validação/antimalware.
10. OCR, extração de texto e IA só depois de autorização, validação do arquivo e isolamento dos dados.

## Modelo de metadados proposto

A tabela `public.document` existente pode ser evoluída sem apagar seus campos atuais. Campos a avaliar na migration:

- `created_by uuid` — usuário autenticado que registrou o arquivo.
- `category text` — categoria jurídica.
- `mime_type text`, `size_bytes bigint`, `sha256 text`.
- `storage_bucket text` e `storage_path text` — referência ao objeto privado.
- `status text` — recebido, em validação, em análise, analisado ou rejeitado.
- `deleted_at timestamptz` — exclusão lógica/auditoria, se necessária.

A coluna legada `file_path` deve ser preservada durante a transição. A associação `case_id` precisa ser obrigatória para documentos jurídicos, após confirmar e validar os registros existentes.

## Bloqueadores antes de habilitar upload real

- Definir e aplicar `owner_user_id` em `public.case` e a tabela `case_access` para owner/editor/viewer.
- Definir a política de acesso e atribuição do registro legado em `tenentes` sem proprietário conhecido.
- Criar relação `case_participants` para separar papéis jurídicos de permissões de acesso.
- Corrigir grants amplos e ativar RLS nas tabelas públicas com policies testadas.
- Criar policies de Storage que consultem a autorização do usuário para o processo, em vez de confiar apenas no nome da pasta.
- Testar usuário anônimo, usuário sem acesso, owner, editor e viewer para upload, leitura, substituição e exclusão.

Não criar policy permissiva baseada apenas em `auth.uid() is not null`, nome de pasta controlado pelo cliente ou bucket_id. Isso permitiria acesso entre processos.

## Referências oficiais

- Supabase Storage Access Control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase Storage Buckets: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase Serving assets / private buckets: https://supabase.com/docs/guides/storage/serving/downloads

## Estado desta entrega

O código contém validação preliminar de metadados e geração de caminhos opacos em `src/features/documents/file-policy.ts`. Isso não realiza upload e não substitui validação do conteúdo no servidor. Nenhuma alteração foi aplicada ao banco Supabase.


## Implementação do upload e quarentena — 03/11/2026

Foram preparados:
- migration `20261103000400_private_document_storage.sql`, com bucket privado `case-documents`, limite de 25 MiB e allowlist MIME;
- rota `POST /api/documentos/upload`, que exige sessão válida e verifica owner/editor antes de usar a chave privilegiada do servidor;
- cliente Supabase administrativo exclusivamente server-side em `src/lib/supabase/admin.ts`;
- validação preliminar de assinatura, extensão/MIME e SHA-256;
- rota `GET /api/documentos/[documentId]/download`, que só emite redirecionamento para signed URL de 5 minutos quando status está `available` e RLS autoriza o usuário;
- estados de quarentena e testes estruturais.

**Atenção:** ainda não existe scanner/antimalware. Todo arquivo fica em `quarantined`, sem download e sem URL assinada. A checagem de magic bytes é preliminar e não prova segurança; DOCX/XLSX exigem inspeção estrutural de ZIP/OOXML. Não liberar documentos até integrar um scanner confiável.

A migration retira gravação de metadados e Storage dos papéis cliente. A rota usa `SUPABASE_SECRET_KEY` (ou a variável legada `SUPABASE_SERVICE_ROLE_KEY`) somente no servidor, depois de autenticar e autorizar o usuário. Essa secret precisa ser configurada manualmente no ambiente de execução seguro; nunca deve ir para GitHub ou variável `NEXT_PUBLIC_*`.

**Não implantado:** nenhuma migration, bucket, secret, upload real ou deploy foi executado.
