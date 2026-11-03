# Provisionamento do primeiro administrador — JurisAI

**Estado:** instrução preparada; nenhum papel foi alterado no Supabase.

A conta inicial já foi confirmada no Supabase Auth e indicada pelo responsável pelo projeto. A migration 20261103000100_app_user_profiles.sql cria o perfil com papel padrão user para todas as identidades. A promoção para platform_admin é uma ação separada, privilegiada e executada somente no SQL Editor do Supabase por operador autorizado.

## Procedimento no ambiente de desenvolvimento

1. Aplicar a migration de perfis na branch Supabase de desenvolvimento.
2. No SQL Editor, substituir o marcador abaixo pelo endereço da conta administrativa confirmada.
3. Executar como administrador do banco (não pela aplicação).
4. Verificar que exatamente um perfil foi promovido.
5. Não gravar o e-mail nem o UUID no GitHub.

~~~sql
begin;

do $$
declare
  target_user_id uuid;
  matched_users integer;
begin
  select count(*), min(id)
    into matched_users, target_user_id
  from auth.users
  where lower(email) = lower('REPLACE_WITH_CONFIRMED_ADMIN_EMAIL')
    and email_confirmed_at is not null;

  if matched_users <> 1 or target_user_id is null then
    raise exception 'Expected exactly one confirmed Auth identity; found %', matched_users;
  end if;

  update public.app_user_profiles
  set platform_role = 'platform_admin'
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
select
  u.email,
  u.email_confirmed_at,
  p.platform_role
from auth.users u
join public.app_user_profiles p on p.user_id = u.id
where lower(u.email) = lower('REPLACE_WITH_CONFIRMED_ADMIN_EMAIL');
~~~

O resultado esperado é uma única conta confirmada com platform_admin.

## Limites de segurança

- Não executar o bootstrap em produção antes de validar a migration e o modelo de RLS no ambiente de desenvolvimento.
- O papel platform_admin administra configurações da plataforma, mas não concede acesso automático a processos, documentos, participantes ou embeddings.
- A promoção não pode ser feita pela interface do usuário, por UPDATE de perfil autenticado ou por autoelevação.
- Não guardar o e-mail, UUID ou qualquer segredo no repositório.
- O procedimento deve ser registrado na trilha de mudanças operacionais do projeto.

**Não executado:** o papel da conta inicial continua não persistido até a migration e o bootstrap serem aplicados no ambiente Supabase de desenvolvimento.
