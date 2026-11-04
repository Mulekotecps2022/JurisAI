-- Structural checks for the enriched legal-person registry.

do $$
declare
  col text;
begin
  foreach col in array array['kind','email','phone','notes'] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public'
        and table_name='tenentes'
        and column_name=col
    ) then
      raise exception 'Missing public.tenentes.% column', col;
    end if;
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.tenentes'::regclass
      and conname='tenentes_kind_check'
  ) then
    raise exception 'Missing tenentes_kind_check constraint';
  end if;

  if has_column_privilege('authenticated','public.tenentes','created_by_user_id','UPDATE') then
    raise exception 'Authenticated clients must not change the creator/owner';
  end if;

  if not has_column_privilege('authenticated','public.tenentes','email','INSERT')
     or not has_column_privilege('authenticated','public.tenentes','kind','UPDATE') then
    raise exception 'Expected contact-field grants are missing';
  end if;

  if has_table_privilege('anon','public.tenentes','SELECT') then
    raise exception 'anon must not read the legal-person registry';
  end if;
end;
$$;
