import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
// Preserve PostgreSQL microseconds in reviewed snapshots (Date truncates them).
pg.types.setTypeParser(1184, (value) => value);

// Only an explicitly supplied disposable database is accepted. Never production.
export async function financeDatabase() {
  const url = process.env.HNTRIP_TEST_DATABASE_URL;
  if (url && !['localhost', '127.0.0.1', 'postgres'].includes(new URL(url).hostname)) throw new Error('Test database must be local/disposable');
  let db;
  if (url) {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    db = { query: (sql, params) => client.query(sql, params), exec: (sql) => client.query(sql), close: () => client.end() };
  } else db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema extensions; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  const root = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of ['20260715140000_access_and_isolation.sql','20260715170000_trips_vertical_slice.sql','20260715190000_trip_management.sql','20260715230000_finance.sql','20260716190000_trip_places.sql','20260722190000_finance_integrity_hardening.sql']) {
    await db.exec((await readFile(new URL(file, root), 'utf8')).replace('create extension if not exists pgcrypto with schema extensions;', ''));
  }
  const archived = await readFile(new URL('20260722193000_archived_trip_read_only.sql', root), 'utf8');
  await db.exec(archived.slice(0, archived.indexOf('do $$')));
  for (const table of ['expenses','expense_categories','trip_places']) await db.exec(`create trigger enforce_active_parent_trip before insert or update or delete on public.${table} for each row execute function private.enforce_active_parent_trip();`);
  await db.exec(await readFile(new URL('20260915202234_planned_expenses.sql', root), 'utf8'));
  return db;
}

export const ids = {
 owner: '10000000-0000-4000-8000-000000000001', admin: '10000000-0000-4000-8000-000000000002', outsider: '10000000-0000-4000-8000-000000000003', inactive: '10000000-0000-4000-8000-000000000004', stranger: '10000000-0000-4000-8000-000000000005',
 workspace: '20000000-0000-4000-8000-000000000001', otherWorkspace: '20000000-0000-4000-8000-000000000002',
 trip: '30000000-0000-4000-8000-000000000001', otherTrip: '30000000-0000-4000-8000-000000000002', sameWorkspaceTrip: '30000000-0000-4000-8000-000000000003',
 category: '40000000-0000-4000-8000-000000000001', otherCategory: '40000000-0000-4000-8000-000000000002',
};
export async function seed(db) {
  const {owner,admin,outsider,inactive,stranger,workspace,otherWorkspace,trip,otherTrip,sameWorkspaceTrip,category,otherCategory}=ids;
  await db.exec(`insert into auth.users(id) values ('${owner}'),('${admin}'),('${outsider}'),('${inactive}'),('${stranger}');
  insert into public.profiles(id) select id from auth.users on conflict do nothing;
  insert into public.workspaces(id,name,slug,created_by,updated_by) values('${workspace}','Test','test-one','${owner}','${owner}'),('${otherWorkspace}','Other','test-two','${outsider}','${outsider}');
  insert into public.workspace_members(workspace_id,user_id,role,status,deactivated_at,created_by,updated_by) values('${workspace}','${owner}','owner','active',null,'${owner}','${owner}'),('${workspace}','${admin}','admin','active',null,'${owner}','${owner}'),('${workspace}','${inactive}','admin','inactive',now(),'${owner}','${owner}'),('${otherWorkspace}','${outsider}','owner','active',null,'${outsider}','${outsider}');
  insert into public.trips(id,workspace_id,name,destination,start_date,end_date,timezone,budget,created_by,updated_by) values('${trip}','${workspace}','Test trip','Test','2026-10-30','2026-11-02','America/Sao_Paulo',3800,'${owner}','${owner}'),('${sameWorkspaceTrip}','${workspace}','Second trip','Test','2026-10-30','2026-11-02','America/Sao_Paulo',3800,'${owner}','${owner}'),('${otherTrip}','${otherWorkspace}','Other trip','Test','2026-10-30','2026-11-02','America/Sao_Paulo',3800,'${outsider}','${outsider}');
  insert into public.expense_categories(id,workspace_id,trip_id,name,created_by,updated_by) values('${category}','${workspace}','${trip}','Food','${owner}','${owner}'),('${otherCategory}','${otherWorkspace}','${otherTrip}','Other','${outsider}','${outsider}');`);
}
export async function asUser(db, user=ids.owner, role='authenticated') {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${user ?? ''}',false); set role ${role};`);
}
