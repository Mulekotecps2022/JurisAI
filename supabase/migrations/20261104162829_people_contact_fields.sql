-- Extend the legacy legal-person registry for application forms.
-- Additive only: existing records are preserved and receive kind='individual'.

begin;

alter table public.tenentes
  add column if not exists kind text not null default 'individual',
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tenentes'::regclass
      and conname = 'tenentes_kind_check'
  ) then
    alter table public.tenentes
      add constraint tenentes_kind_check
      check (kind in ('individual', 'organization'));
  end if;
end;
$$;

comment on column public.tenentes.kind is
  'Legal-person registry type: individual or organization; not an authentication tenant.';
comment on column public.tenentes.email is
  'Optional contact email for the legal person/entity.';
comment on column public.tenentes.phone is
  'Optional contact phone for the legal person/entity.';
comment on column public.tenentes.notes is
  'Optional notes about the legal person/entity.';

-- Keep browser privileges limited to the creator-only RLS policies.
revoke all on table public.tenentes from anon, authenticated;
grant select on table public.tenentes to authenticated;
grant insert (name, kind, email, phone, notes, created_by_user_id)
  on public.tenentes to authenticated;
grant update (name, kind, email, phone, notes)
  on public.tenentes to authenticated;

commit;
