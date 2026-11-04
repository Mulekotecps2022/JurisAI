# Provisionamento do primeiro administrador — JurisAI

**Estado em 04/11/2026: concluído no Supabase `JurisAI-Desenvolvimento`.**

A identidade inicial aceitou o convite pelo Supabase Auth. A confirmação de e-mail foi verificada, o trigger criou o perfil padrão e a promoção controlada para `platform_admin` foi executada no banco de desenvolvimento. Uma consulta independente confirmou que o papel ficou persistido.

## Evidências técnicas

- Identidade presente em `auth.users`, com e-mail confirmado.
- Perfil correspondente presente em `public.app_user_profiles`.
- Papel persistido: `platform_admin`.
- Sob contexto SQL `authenticated` e subject JWT da identidade, `public.is_platform_admin()` retornou `true`.
- O perfil administrativo consegue consultar apenas o próprio perfil.
- A função administrativa não concede acesso implícito a processos, documentos ou embeddings.
- O papel `anon` não possui SELECT em perfis, processos ou documentos.
- O cliente autenticado não pode alterar `platform_role`, inserir/apagar perfis, apagar processos ou inserir embeddings.

## Limites de segurança

- Concluído somente no projeto de desenvolvimento.
- Não armazenar e-mail, UUID, senha ou tokens no GitHub.
- `platform_admin` não concede acesso automático a processos, documentos, participantes ou embeddings.
- Não criar usuários por INSERT manual em tabelas internas do Auth.
- Produção permanece sem alterações.

## Próxima validação

A validação SQL confirma o papel e os privilégios no banco. Ainda é necessário testar o login pela interface hospedada e validar sessão/cookies no navegador após a configuração do ambiente de aplicação.
