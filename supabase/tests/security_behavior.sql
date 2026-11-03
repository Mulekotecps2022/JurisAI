-- Multi-identity RLS behavior tests. Runs only in disposable CI PostgreSQL.
begin;

insert into public.tenentes (id, name, created_by_user_id)
values (
  '10000000-0000-4000-8000-000000000002',
  'Entity owned by case owner',
  '00000000-0000-4000-8000-000000000001'
);

insert into public."case" (id, owner_user_id, title, description)
values (
  '20000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'Private test case',
  'Disposable CI fixture'
);

insert into public.case_access (case_id, user_id, role, granted_by)
values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'editor', '00000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'viewer', '00000000-0000-4000-8000-000000000001');

insert into public.case_participants (case_id, tenente_id, role)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'client'
);

insert into public.document (
  id, case_id, file_name, created_by_user_id, mime_type, size_bytes,
  sha256, storage_bucket, storage_path, status
)
values (
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'contract.pdf',
  '00000000-0000-4000-8000-000000000001',
  'application/pdf',
  128,
  repeat('a', 64),
  'case-documents',
  '20000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/original.pdf',
  'available'
);

insert into public.embedding (document_id, content, vector)
values (
  '30000000-0000-4000-8000-000000000001',
  'private searchable text',
  '[0.1,0.2,0.3]'
);

insert into storage.objects (bucket_id, name, metadata)
values (
  'case-documents',
  '20000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/original.pdf',
  '{"mimetype":"application/pdf","size":128}'::jsonb
);

update public.app_user_profiles
set platform_role = 'platform_admin'
where user_id = '00000000-0000-4000-8000-000000000004';

-- Owner: sees all linked records and can update the case.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public."case") <> 1 then
    raise exception 'Owner cannot see owned case';
  end if;
  if (select count(*) from public.document) <> 1 then
    raise exception 'Owner cannot see case document';
  end if;
  if (select count(*) from public.embedding) <> 1 then
    raise exception 'Owner cannot see case embedding';
  end if;
  if (select count(*) from public.case_participants) <> 1 then
    raise exception 'Owner cannot see legal participants';
  end if;
  if (select count(*) from public.tenentes where id = '10000000-0000-4000-8000-000000000002') <> 1 then
    raise exception 'Owner cannot see entity attached to accessible case';
  end if;
  if (select count(*) from public.tenentes where id = '10000000-0000-4000-8000-000000000001') <> 0 then
    raise exception 'Legacy unassigned entity leaked to owner';
  end if;
  if (select count(*) from storage.objects) <> 1 then
    raise exception 'Owner cannot read available private object';
  end if;
end;
$$;
update public."case" set title = 'Owner updated title'
where id = '20000000-0000-4000-8000-000000000001';
reset role;

-- Editor: can read the case and its records, but cannot manage collaborators
-- or delete the owner's document.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public."case") <> 1
     or (select count(*) from public.document) <> 1
     or (select count(*) from public.embedding) <> 1 then
    raise exception 'Editor cannot access shared case data';
  end if;
  if (select count(*) from public.case_access where user_id = '00000000-0000-4000-8000-000000000003') <> 0 then
    raise exception 'Editor can enumerate another collaborator';
  end if;
  if (select count(*) from storage.objects) <> 1 then
    raise exception 'Editor cannot read available private object';
  end if;
end;
$$;
delete from public.document
where id = '30000000-0000-4000-8000-000000000001';
do $$
begin
  if (select count(*) from public.document) <> 1 then
    raise exception 'Editor unexpectedly deleted owner document';
  end if;
end;
$$;
reset role;

-- Viewer: read-only access to the shared case, its document, embedding and file.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public."case") <> 1
     or (select count(*) from public.document) <> 1
     or (select count(*) from public.embedding) <> 1
     or (select count(*) from storage.objects) <> 1 then
    raise exception 'Viewer cannot read authorized case content';
  end if;
end;
$$;
update public."case" set title = 'Viewer must not update'
where id = '20000000-0000-4000-8000-000000000001';
do $$
begin
  if (select title from public."case" where id = '20000000-0000-4000-8000-000000000001') <> 'Owner updated title' then
    raise exception 'Viewer unexpectedly modified case';
  end if;
end;
$$;
reset role;

-- Platform admin without case membership has no automatic legal-content access.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
set local role authenticated;
do $$
begin
  if not public.is_platform_admin() then
    raise exception 'Fixture platform admin role was not provisioned';
  end if;
  if (select count(*) from public."case") <> 0
     or (select count(*) from public.document) <> 0
     or (select count(*) from public.embedding) <> 0
     or (select count(*) from storage.objects) <> 0 then
    raise exception 'Platform admin received implicit case-content access';
  end if;
end;
$$;
reset role;

-- Unrelated user cannot discover rows by knowing UUIDs.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public."case") <> 0
     or (select count(*) from public.document) <> 0
     or (select count(*) from public.embedding) <> 0
     or (select count(*) from storage.objects) <> 0 then
    raise exception 'Unrelated user discovered private case data';
  end if;
end;
$$;
reset role;

rollback;
