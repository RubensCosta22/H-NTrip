begin;

select plan(13);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'workspaces', 'workspaces exists');
select has_table('public', 'workspace_members', 'workspace_members exists');
select has_table('public', 'audit_logs', 'audit_logs exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.workspaces'::regclass),
  'workspaces has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.workspace_members'::regclass),
  'workspace_members has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.audit_logs'::regclass),
  'audit_logs has RLS enabled'
);

insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000001', 'owner-a@example.test'),
  ('10000000-0000-0000-0000-000000000002', 'owner-b@example.test'),
  ('10000000-0000-0000-0000-000000000003', 'memberless@example.test');

insert into public.workspaces (id, name, slug, created_by, updated_by)
values
  (
    '20000000-0000-0000-0000-000000000001', 'Workspace A', 'workspace-a',
    '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'
  ),
  (
    '20000000-0000-0000-0000-000000000002', 'Workspace B', 'workspace-b',
    '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'
  );

insert into public.workspace_members (
  workspace_id, user_id, role, status, joined_at, created_by, updated_by
)
values
  (
    '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
    'owner', 'active', now(), '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
    'owner', 'active', now(), '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select is(
  (select count(*) from public.workspaces),
  1::bigint,
  'member sees only their workspace'
);
select is(
  (select count(*) from public.workspace_members),
  1::bigint,
  'member sees no membership from another workspace'
);
select is(
  (select count(*) from public.profiles),
  1::bigint,
  'member sees no profile from another workspace'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select is(
  (select count(*) from public.workspaces),
  0::bigint,
  'authenticated user without membership sees no workspace'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select * from public.workspaces$$,
  '42501',
  null,
  'anonymous user has no table privilege'
);

select * from finish();
rollback;
