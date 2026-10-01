import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildPlaceImportSql } from '../scripts/import-place-estimates.mjs';
import { financeDatabase, seed, asUser, ids } from './helpers/finance-db.mjs';

const create = async (db, amount='500', key=randomUUID(), category=ids.category) => (await db.query('select * from public.add_planned_expense($1,$2,$3,$4,$5,$6,$7)',[ids.trip,category,'Jantar','Test','2026-10-31',amount,key])).rows[0];
const confirm = async(db,id,amount='420',key=randomUUID()) => (await db.query('select * from public.confirm_planned_expense($1,$2,$3,$4)',[id,amount,'2026-10-31',key])).rows[0];
const summary = async(db) => (await db.query('select public.trip_finance_summary($1) s',[ids.trip])).rows[0].s;
const amounts = (s) => Object.fromEntries(Object.entries(s).map(([k,v])=>[k,Number(v)]));

test('planned expenses: transactional lifecycle, RLS, precision and totals', async(t)=>{
 const db=await financeDatabase(); t.after(()=>db.close()); await seed(db); await asUser(db);
 let plan, payment; const creationKey=randomUUID(),confirmationKey=randomUUID();
 await t.test('plan is not a payment; repeated creation is idempotent',async()=>{
  plan=await create(db,'500',creationKey); assert.equal((await create(db,'500',creationKey)).id,plan.id);
  assert.deepEqual(amounts(await summary(db)),{planned:500,pending:500,actual:0,projected:500,margin:3300,actual_balance:3800});
  await assert.rejects(()=>create(db,'501',creationKey),/idempotency_key_conflict/);
 });
 await t.test('confirmation preserves estimate and exact original payment on retries',async()=>{
  payment=await confirm(db,plan.id,'420',confirmationKey);
  assert.equal((await confirm(db,plan.id,'420',confirmationKey)).id,payment.id);
  assert.deepEqual(amounts(await summary(db)),{planned:500,pending:0,actual:420,projected:420,margin:3380,actual_balance:3380});
  await assert.rejects(()=>confirm(db,plan.id,'419',confirmationKey),/idempotency_key_conflict/);
  await assert.rejects(()=>confirm(db,plan.id,'420'),/already_confirmed/);
  await assert.rejects(()=>db.query('select public.cancel_planned_expense($1)',[plan.id]),/reverse_expense_before_cancel/);
 });
 await t.test('direct payments, reversal and retry after reversal do not double count',async()=>{
  await db.query('select public.add_expense($1,$2,$3,$4,$5,$6,$7)',[ids.trip,ids.category,'Extra','','2026-10-31','50',randomUUID()]);
  assert.equal(Number((await summary(db)).projected),470);
  await db.query('select public.reverse_expense($1)',[payment.id]);
  assert.equal(Number((await summary(db)).projected),550);
  await assert.rejects(()=>confirm(db,plan.id,'420',confirmationKey),/confirmation_reversed/);
  const replacement=await confirm(db,plan.id,'400'); assert.notEqual(replacement.id,payment.id);
  await assert.rejects(()=>confirm(db,plan.id,'420',confirmationKey),/confirmation_reversed/);
  await db.query('select public.reverse_expense($1)',[replacement.id]);
  await db.query('select public.cancel_planned_expense($1)',[plan.id]);
  await db.query('select public.cancel_planned_expense($1)',[plan.id]);
  assert.deepEqual(amounts(await summary(db)),{planned:0,pending:0,actual:50,projected:50,margin:3750,actual_balance:3750});
  await assert.rejects(()=>confirm(db,plan.id),/cancelled/);
  assert.equal((await db.query('select count(*)::int n from public.planned_expense_confirmations')).rows[0].n,2);
 });
 await t.test('invalid monetary values and foreign categories rejected',async()=>{
  for(const value of ['0','-1','1.001','1000000000000','NaN','Infinity','-Infinity']) await assert.rejects(()=>create(db,value),/invalid_expense_input/);
  await assert.rejects(()=>create(db,'10',randomUUID(),ids.otherCategory),/expense_category_unavailable/);
  const cent=await create(db,'0.01');assert.equal(Number(cent.planned_amount),0.01);
 });
 await t.test('owner/admin allowed; outsiders, inactive, unaffiliated and anonymous denied',async()=>{
  await asUser(db,ids.admin);const adminPlan=await create(db,'10');assert.equal(adminPlan.created_by,ids.admin);
  for(const user of [ids.outsider,ids.inactive,ids.stranger]){
   await asUser(db,user);
   assert.equal((await db.query('select * from public.planned_expenses where trip_id=$1',[ids.trip])).rows.length,0);
   assert.equal((await db.query('select * from public.planned_expense_confirmations where trip_id=$1',[ids.trip])).rows.length,0);
   await assert.rejects(()=>create(db),/access_denied/);
   await assert.rejects(()=>confirm(db,adminPlan.id),/access_denied/);
   await assert.rejects(()=>summary(db),/access_denied/);
   await assert.rejects(()=>db.query('select public.trip_finance_export($1)',[ids.trip]),/access_denied/);
  }
  await asUser(db,null,'anon'); await assert.rejects(()=>create(db),/permission denied/);
  await asUser(db); await assert.rejects(()=>db.query('update public.planned_expenses set planned_amount=1'),/permission denied/);
  await assert.rejects(()=>db.query('delete from public.planned_expense_confirmations'),/permission denied/);
 });
 await t.test('composite foreign keys prevent cross-trip attachment; archive and currency guards hold',async()=>{
  await db.exec('reset role');
  await assert.rejects(()=>db.query('update public.planned_expenses set trip_id=$1 where id=$2',[ids.sameWorkspaceTrip,plan.id]),/foreign key/);
  await assert.rejects(()=>db.query("update public.trips set base_currency='USD' where id=$1",[ids.trip]),/currency_has_financial_records/);
  await db.query("update public.trips set status='archived',archived_at=now() where id=$1",[ids.trip]); await asUser(db);
  await assert.rejects(()=>create(db),/archived_trip/); await assert.rejects(()=>confirm(db,plan.id),/archived_trip/);
  await assert.rejects(()=>db.query('select public.reverse_expense($1)',[payment.id]),/archived_trip/);
  await db.exec('reset role'); await db.query("update public.trips set status='planned',archived_at=null where id=$1",[ids.trip]);await asUser(db);
 });
 await t.test('more than 1000 records remain exact and summary uses one stable snapshot',async()=>{
  await db.exec('reset role');
  await db.query(`insert into public.planned_expenses(workspace_id,trip_id,category_id,description,planned_date,planned_amount,currency,idempotency_key,created_by,updated_by)
   select $1,$2,$3,'Small expense '||n,date '2026-10-31',0.01,'BRL',gen_random_uuid(),$4,$4 from generate_series(1,1001)n`,[ids.workspace,ids.trip,ids.category,ids.owner]);
  await asUser(db);const start=performance.now();const s=amounts(await summary(db));
  assert.equal(s.planned,20.02);assert.equal(s.projected,70.02);
  const exported=(await db.query('select public.trip_finance_export($1) e',[ids.trip])).rows[0].e;
  assert.equal(exported.planned_expenses.length,1004);
  for(const entry of exported.confirmations) assert.ok(exported.expense_history.some(e=>e.id===entry.expense_id));
  assert.ok(exported.expenses.every(e=>!('idempotency_key' in e)));assert.ok(performance.now()-start<1000);
  assert.equal((await db.query("select provolatile from pg_proc where oid='public.trip_finance_summary(uuid)'::regprocedure")).rows[0].provolatile,'s');
 });
 await t.test('snapshot import is atomic, detects item drift, and cannot duplicate',async()=>{
  await db.exec('reset role');const category=randomUUID(), place=randomUUID();
  await db.query('insert into public.expense_categories(id,workspace_id,trip_id,name,created_by,updated_by) values($1,$2,$3,$4,$5,$5)',[category,ids.workspace,ids.sameWorkspaceTrip,'Import test',ids.owner]);
  const source=(await db.query("insert into public.trip_places(id,workspace_id,trip_id,name,category,starts_on,planned_cost,created_by,updated_by) values($1,$2,$3,'Example $import$ O''Brien','other','2026-10-30',123.45,$4,$4) returning *",[place,ids.workspace,ids.sameWorkspaceTrip,ids.owner])).rows[0];
  const snap={tripId:ids.sameWorkspaceTrip,workspaceId:ids.workspace,actorId:ids.owner,batchId:randomUUID(),budget:'3800',currency:'BRL',total:'123.45',items:[{id:place,categoryId:category,name:"Example $import$ O'Brien",date:'2026-10-30',amount:'123.45',updatedAt:source.updated_at}]};
  const changed=structuredClone(snap);changed.items[0].name='Changed';
  await assert.rejects(()=>db.exec(buildPlaceImportSql(changed,{commit:true})),/source_snapshot_changed/);await db.exec('rollback');
  await db.exec(buildPlaceImportSql(snap));assert.equal((await db.query('select count(*)::int n from public.planned_expenses where trip_id=$1',[ids.sameWorkspaceTrip])).rows[0].n,0);
  await db.exec(buildPlaceImportSql(snap,{commit:true}));await db.exec(buildPlaceImportSql(snap,{commit:true}));
  assert.equal((await db.query('select count(*)::int n from public.planned_expenses where trip_id=$1',[ids.sameWorkspaceTrip])).rows[0].n,1);
  const differentBatch={...snap,batchId:randomUUID()};await assert.rejects(()=>db.exec(buildPlaceImportSql(differentBatch,{commit:true})),/finance_requires_reconciliation/);await db.exec('rollback');
  await asUser(db);
 });
 if(process.env.HNTRIP_TEST_DATABASE_URL) await t.test('two backend sessions serialize conflicting confirmations and retries',async()=>{
  const p=await create(db,'100'); const key=randomUUID();
  const c1=new pg.Client({connectionString:process.env.HNTRIP_TEST_DATABASE_URL});const c2=new pg.Client({connectionString:process.env.HNTRIP_TEST_DATABASE_URL});
  await c1.connect();await c2.connect();
  try{
   for(const c of [c1,c2]) await c.query(`select set_config('request.jwt.claim.sub','${ids.owner}',false);set role authenticated;`);
   const results=await Promise.allSettled([confirm(c1,p.id,'90',key),confirm(c2,p.id,'80',randomUUID())]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
   const current=(await db.query('select confirmed_expense_id from public.planned_expenses where id=$1',[p.id])).rows[0];
   await Promise.all([c1.query('select public.reverse_expense($1)',[current.confirmed_expense_id]),c2.query('select public.reverse_expense($1)',[current.confirmed_expense_id])]);
   const retryKey=randomUUID(); const same=await Promise.all([confirm(c1,p.id,'70',retryKey),confirm(c2,p.id,'70',retryKey)]);assert.equal(same[0].id,same[1].id);
   const q=await create(db,'20');const cancelVsConfirm=await Promise.allSettled([confirm(c1,q.id,'19'),c2.query('select public.cancel_planned_expense($1)',[q.id])]);assert.equal(cancelVsConfirm.filter(r=>r.status==='fulfilled').length,1);
   const r=await create(db,'20');await c1.query('begin');await c1.query('select public.confirm_planned_expense($1,$2,$3,$4)',[r.id,18,'2026-10-31',randomUUID()]);
   await c2.query('reset role');const archive=c2.query("update public.trips set status='archived',archived_at=now() where id=$1",[ids.trip]);await c1.query('commit');await archive;
   await c2.query("update public.trips set status='planned',archived_at=null where id=$1",[ids.trip]);
  }finally{await c1.end();await c2.end();}
 });
});
