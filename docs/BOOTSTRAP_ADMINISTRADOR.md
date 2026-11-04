# Bootstrap do administrador inicial — JurisAI

Este documento complementa `BOOTSTRAP_ADMIN_INICIAL.md`. O projeto ativo de desenvolvimento está sem usuários Auth (zero contas e zero perfis no momento da auditoria de 04/11/2026), portanto não existe identidade administrativa a promover ainda.

## Procedimento correto

1. Confirmar o endereço da conta inicial com o responsável pelo projeto.
2. Criar/convidar a identidade usando Supabase Auth (Dashboard ou API Admin server-side confiável). Não inserir registros manualmente em `auth.users`.
3. Confirmar o e-mail.
4. Verificar que o trigger criou um perfil com papel padrão `user`.
5. Executar o procedimento de promoção para `platform_admin` descrito em `BOOTSTRAP_ADMIN_INICIAL.md`, somente no projeto de desenvolvimento.
6. Verificar que a conta não recebe acesso automático aos processos, documentos ou embeddings.

## Segurança

- O papel `platform_admin` é separado da propriedade de processos e dos papéis `editor`/`viewer`.
- O cliente não pode alterar `platform_role` nem promover outra conta.
- A chave `service_role`/secret nunca pode ser usada no navegador ou commitada.
- O registro legado de `tenentes` e a tabela `CASE` maiúscula permanecem intocados.
- Não executar promoção em produção.

**Estado:** aguardando identidade inicial confirmada no projeto `JurisAI-Desenvolvimento`.
