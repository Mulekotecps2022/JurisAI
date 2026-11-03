# Bootstrap do administrador inicial — JurisAI

**Estado:** instruções preparatórias. Nenhuma promoção de papel foi executada e nenhuma migration foi aplicada.

## Identidade confirmada

O responsável pelo projeto confirmou o endereço administrativo e concluiu o convite no Supabase Auth. A identidade foi localizada em `auth.users`, com e-mail confirmado e primeiro acesso registrado. O e-mail e o UUID não são copiados para o repositório.

## Ordem segura

1. Fazer backup e revisar a migration `supabase/migrations/20261103000100_app_user_profiles.sql`.
2. Aplicar primeiro em uma branch de desenvolvimento isolada do Supabase e executar os testes descritos em `supabase/tests/app_user_profiles_security.sql`.
3. Confirmar que a conta administrativa continua sendo a identidade escolhida pelo responsável.
4. Em uma sessão administrativa confiável do SQL Editor, consultar somente o UUID da conta confirmada, usando o endereço informado pelo responsável; não copiar o resultado para commits, logs ou documentação.
5. Após substituir o marcador abaixo pelo UUID verificado, executar a promoção em transação. O marcador não é um UUID válido e não deve ser executado literalmente.

```sql
begin;

update public.app_user_profiles
set platform_role = 'platform_admin',
    updated_at = now()
where user_id = 'SUBSTITUIR_PELO_UUID_CONFIRMADO'::uuid;

do $$
begin
  if not exists (
    select 1
    from public.app_user_profiles
    where user_id = 'SUBSTITUIR_PELO_UUID_CONFIRMADO'::uuid
      and platform_role = 'platform_admin'
  ) then
    raise exception 'Bootstrap administrativo não confirmou exatamente a conta indicada';
  end if;
end;
$$;

commit;
```

6. Verificar o papel com uma consulta restrita à mesma identidade e testar que outra conta não consegue consultar perfis alheios nem alterar `platform_role`.
7. Somente depois, planejar migrations separadas para propriedade de processos, `case_access`, participantes jurídicos e RLS dos dados.

## Limites importantes

- `platform_admin` é papel administrativo da aplicação, não proprietário automático de processos.
- Esse papel não concede acesso automático a documentos, embeddings, clientes ou casos.
- Não existe endpoint público para autoelevação; clientes não recebem permissão SQL para alterar `platform_role`.
- O trigger cria novos perfis com papel `user`, nunca como administrador.
- A função `is_platform_admin()` consulta o perfil em contexto controlado, com `SECURITY DEFINER` e `search_path` vazio.
- A chave `service_role` nunca deve ser usada no navegador.
- A tabela `tenentes` e o registro legado permanecem intocados.
- A tabela `CASE` maiúscula permanece intocada.
- Esta migration não ativa RLS nas tabelas de processos/documentos nem altera seus grants. Isso será tratado em etapa própria, com políticas completas e testes de isolamento.

## Rollback

O rollback não deve ser improvisado em produção. Em ambiente de desenvolvimento, após exportar resultados dos testes, remover primeiro o trigger, depois as funções e policies, e por último a tabela de perfil, somente se nenhuma funcionalidade já depender dela. A reversão em produção exige revisão específica e backup; não executar DROP automaticamente.
