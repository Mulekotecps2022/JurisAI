# Provisionamento do primeiro administrador — JurisAI

**Estado em 04/11/2026:** ainda não executado no Supabase `JurisAI-Desenvolvimento`.

A consulta direta ao ambiente ativo confirmou zero registros em `auth.users` e zero perfis em `public.app_user_profiles`. Portanto, as anotações históricas que mencionavam uma conta confirmada pertenciam a outro estado/projeto e não comprovam que exista uma conta no ambiente atual.

## Passos necessários

1. Confirmar com o responsável qual endereço de e-mail será a identidade inicial.
2. Convidar esse endereço pelo Supabase Auth (Dashboard ou fluxo administrativo seguro). Não inserir manualmente em `auth.users`.
3. Concluir a confirmação de e-mail.
4. A migration `app_user_profiles` já cria automaticamente um perfil com papel padrão `user` para novas identidades.
5. No SQL Editor do projeto de desenvolvimento, executar a promoção abaixo substituindo o marcador pelo e-mail confirmado.
6. Verificar uma única conta com papel `platform_admin`.

~~~sql
begin;

do $$
declare
  target_user_id uuid;
  matched_users integer;
begin
  select count(*)
    into matched_users
  from auth.users
  where lower(email) = lower('REPLACE_WITH_CONFIRMED_ADMIN_EMAIL')
    and email_confirmed_at is not null;

  if matched_users <> 1 then
    raise exception 'Expected exactly one confirmed Auth identity; found %', matched_users;
  end if;

  select id into target_user_id
  from auth.users
  where lower(email) = lower('REPLACE_WITH_CONFIRMED_ADMIN_EMAIL')
    and email_confirmed_at is not null;

  update public.app_user_profiles
  set platform_role = 'platform_admin',
      updated_at = now()
  where user_id = target_user_id;

  if not found then
    raise exception 'Application profile does not exist for the confirmed Auth user';
  end if;
end;
$$;

commit;
~~~

## Verificação

~~~sql
select p.platform_role
from auth.users u
join public.app_user_profiles p on p.user_id = u.id
where lower(u.email) = lower('REPLACE_WITH_CONFIRMED_ADMIN_EMAIL')
  and u.email_confirmed_at is not null;
~~~

Resultado esperado: uma única linha com `platform_admin`.

## Limites

- Não executar em produção nesta etapa.
- Não armazenar e-mail, UUID ou segredos no GitHub.
- `platform_admin` não concede acesso automático a processos, documentos, participantes ou embeddings.
- Não criar usuário por INSERT manual em tabelas internas do Auth.
- A promoção só pode ocorrer depois de confirmar a identidade pelo responsável.

**Pendente:** confirmação do e-mail inicial e convite pelo Supabase Auth.
