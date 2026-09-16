// Administrative one-time import. No credentials or trip data belong in this file.
// Supply a reviewed private snapshot; preview is a rollback transaction by default.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function buildPlaceImportSql(snapshot, { commit = false } = {}) {
  const { tripId, workspaceId, actorId, batchId, budget, currency, total, items } = snapshot;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (![tripId,workspaceId,actorId,batchId].every(x=>uuid.test(x)) || !Array.isArray(items) || !items.length || !/^\d+(\.\d{1,2})?$/.test(String(total)) || !/^\d+(\.\d{1,2})?$/.test(String(budget)) || !/^[A-Z]{3}$/.test(currency)) throw new Error('Invalid import snapshot');
  if (new Set(items.map(x=>x.id)).size!==items.length || items.some(x=>!uuid.test(x.id)||!uuid.test(x.categoryId)||!x.updatedAt||!x.name||!/^\d{4}-\d{2}-\d{2}$/.test(x.date)||!/^\d+(\.\d{1,2})?$/.test(String(x.amount)))) throw new Error('Invalid item snapshot');
  const json = Buffer.from(JSON.stringify(items), "utf8").toString("hex");
  return `begin;
set local lock_timeout='3s';
lock table public.expenses in share mode nowait;
do $import$
declare t public.trips; item jsonb; source public.trip_places; snapshot jsonb := convert_from(decode('${json}','hex'),'UTF8')::jsonb; imported integer; actor uuid := '${actorId}'; batch uuid := '${batchId}';
begin
 select * into strict t from public.trips where id='${tripId}' and workspace_id='${workspaceId}' for update nowait;
 if t.archived_at is not null or t.budget<>${budget} or t.base_currency<>'${currency}' then raise exception 'trip_snapshot_changed'; end if;
 if not exists(select 1 from public.workspace_members where workspace_id=t.workspace_id and user_id=actor and status='active' and role='owner') then raise exception 'owner_access_denied'; end if;
 select count(*) into imported from public.planned_expenses where trip_id=t.id and import_batch_id=batch;
 if imported>0 then
  if imported<>jsonb_array_length(snapshot) or exists(select 1 from jsonb_array_elements(snapshot) j where not exists(select 1 from public.planned_expenses p where p.trip_id=t.id and p.import_batch_id=batch and p.source_place_id=(j->>'id')::uuid and p.description=j->>'name' and p.category_id=(j->>'categoryId')::uuid and p.planned_amount=(j->>'amount')::numeric and p.planned_date=(j->>'date')::date)) then raise exception 'import_batch_conflict'; end if;
  return;
 end if;
 if exists(select 1 from public.expenses where trip_id=t.id) or exists(select 1 from public.planned_expenses where trip_id=t.id) then raise exception 'finance_requires_reconciliation'; end if;
 if (select sum((j->>'amount')::numeric) from jsonb_array_elements(snapshot) j)<>${total} then raise exception 'import_total_mismatch'; end if;
 if (select count(*) from public.trip_places where trip_id=t.id and archived_at is null and planned_cost>0)<>jsonb_array_length(snapshot) then raise exception 'source_count_changed'; end if;
 for item in select value from jsonb_array_elements(snapshot) loop
  select * into strict source from public.trip_places where id=(item->>'id')::uuid and trip_id=t.id and workspace_id=t.workspace_id and archived_at is null for update nowait;
  if source.updated_at<>(item->>'updatedAt')::timestamptz or source.name is distinct from item->>'name' or source.planned_cost is distinct from (item->>'amount')::numeric or coalesce(source.starts_on,t.start_date)<>(item->>'date')::date then raise exception 'source_snapshot_changed'; end if;
  if not exists(select 1 from public.expense_categories where id=(item->>'categoryId')::uuid and trip_id=t.id and workspace_id=t.workspace_id and archived_at is null) then raise exception 'category_unavailable'; end if;
  insert into public.planned_expenses(workspace_id,trip_id,category_id,description,planned_date,planned_amount,currency,source_place_id,import_batch_id,idempotency_key,created_by,updated_by)
  values(t.workspace_id,t.id,(item->>'categoryId')::uuid,item->>'name',(item->>'date')::date,(item->>'amount')::numeric,t.base_currency,source.id,batch,gen_random_uuid(),actor,actor);
 end loop;
 if (select sum(planned_amount) from public.planned_expenses where trip_id=t.id and import_batch_id=batch)<>${total} then raise exception 'import_result_mismatch'; end if;
 insert into public.audit_logs(workspace_id,actor_id,action,resource_type,resource_id,metadata) values(t.workspace_id,actor,'finance.planned_imported','trip',t.id,jsonb_build_object('batch_id',batch,'items',jsonb_array_length(snapshot)));
end $import$;
${commit ? 'commit' : 'rollback'};`;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output, flag] = process.argv.slice(2);
  if (!input || !output || (flag && flag !== '--commit')) throw new Error('Usage: node scripts/import-place-estimates.mjs PRIVATE_SNAPSHOT.json PRIVATE_OUTPUT.sql [--commit]');
  await writeFile(output, buildPlaceImportSql(JSON.parse(await readFile(input,'utf8')), {commit:flag==='--commit'}), {mode:0o600});
  console.log(flag==='--commit' ? 'Reviewed import SQL prepared; not executed.' : 'Preview SQL prepared with ROLLBACK; not executed.');
}
