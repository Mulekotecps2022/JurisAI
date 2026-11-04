# Bootstrap do administrador inicial — JurisAI

**Estado em 04/11/2026: concluído no projeto JurisAI-Desenvolvimento.**

A identidade inicial aceitou o convite pelo Supabase Auth. O e-mail foi confirmado, o trigger criou o perfil padrão e a promoção controlada para `platform_admin` foi executada no ambiente de desenvolvimento. Uma consulta posterior confirmou o papel persistido.

## Verificações realizadas

- Identidade existe em `auth.users` e está confirmada.
- Perfil correspondente existe em `public.app_user_profiles`.
- `platform_role = 'platform_admin'`.
- Sob contexto SQL `authenticated` com o JWT subject da identidade, `public.is_platform_admin()` retornou `true`.
- A identidade visualiza somente o próprio perfil.
- A identidade administrativa não recebeu acesso implícito a processos, documentos ou embeddings (nenhuma linha visível sem vínculo).
- `anon` não possui SELECT em perfis, processos ou documentos.
- O cliente autenticado não pode alterar `platform_role`, inserir/apagar perfis, apagar processos ou gravar embeddings.

## Segurança

- O papel `platform_admin` é separado da propriedade de processos e dos papéis `editor`/`viewer`.
- O cliente não pode alterar `platform_role` nem promover outra conta.
- A chave `service_role`/secret nunca pode ser usada no navegador ou commitada.
- O registro legado de `tenentes` e a tabela `CASE` maiúscula permanecem intocados.
- A promoção ocorreu somente em desenvolvimento; produção não foi alterada.

## Limitação remanescente

A validação SQL comprova o perfil e os privilégios no banco, mas não substitui o teste manual de login pela interface hospedada nem o teste de sessão/cookies no navegador. Esse teste deverá ocorrer após a configuração/validação do ambiente de aplicação.

Não registrar neste documento o e-mail, UUID, senha ou qualquer token da conta.
