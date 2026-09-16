// Actual page/components with synthetic data and failed-action mocks, no live credentials.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const root=resolve('.'), dir=await mkdtemp(join(tmpdir(),'hntrip-finance-ui-'));
const mock=`import React from 'react';
export const initialAccessState={status:'idle'};
export async function addExpenseAction(previous, data){window.submissions.push(Object.fromEntries(data));return {status:'error',message:'Falha de conexão simulada. Tente novamente.'};}
export const confirmPlannedExpenseAction=addExpenseAction;
export const addExpenseCategoryAction=addExpenseAction;
export async function cancelPlannedExpenseAction(){} export async function reverseExpenseAction(){}
export const TripRealtimeRefresh=()=>null;
export const requireCurrentMember=async()=>({workspaceId:'workspace'});
export const getSupabasePublicConfig=()=>({url:'http://localhost',publishableKey:'test'});
export const notFound=()=>{throw Error('not found')};
export default function Link({href,children,...props}){return React.createElement('a',{href,...props},children);}
const data={trips:{id:'trip',name:'Viagem de teste',base_currency:'BRL',budget:3800},expense_categories:[{id:'category',name:'Alimentação',color:'#F59E0B'}],expenses:[{id:'payment',description:'Café realizado',category_id:'category',expense_date:'2026-10-31',amount:50}],planned_expenses:[{id:'plan',description:'Jantar previsto',category_id:'category',planned_date:'2026-10-31',planned_amount:500,payment:null},{id:'confirmed',description:'Passeio confirmado',category_id:'category',planned_date:'2026-10-31',planned_amount:100,payment:{amount:90,expense_date:'2026-10-31',deleted_at:null}}]};
export const createServerSupabaseClient=async()=>({from(table){const q={select(){return q},eq(){return q},is(){return q},order(){return q},range(){return q},or(){return q},maybeSingle(){return q},then(resolve){return resolve({data:data[table],count:Array.isArray(data[table])?data[table].length:1,error:null})}};return q},rpc:async()=>({data:{actual:'140',planned:'600',pending:'500',projected:'640',margin:'3160'}})});`;
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Finance from './app/(app)/trips/[tripId]/finance/page.tsx';import './app/globals.css';import './app/brand-system.css';import './app/brand-overrides.css';import './app/brand-polish.css';import './app/brand-v2.css';window.submissions=[];const tree=await Finance({params:Promise.resolve({tripId:'trip'}),searchParams:Promise.resolve({})});createRoot(document.getElementById('root')).render(tree);`,resolveDir:root,loader:'tsx'},bundle:true,conditions:['style','browser','import'],external:['/auth-landscape.png'],format:'esm',outfile:join(dir,'app.js'),jsx:'automatic',plugins:[{name:'mocks',setup(b){b.onResolve({filter:/^(next\/link|next\/navigation|.*features\/access\/actions|.*lib\/auth\/current-member|.*lib\/supabase\/server|.*lib\/supabase\/config|.*trip-realtime-refresh)$/},a=>({path:a.path,namespace:'mock'}));b.onResolve({filter:/^\.\/actions$/},a=>a.importer.includes('/features/finance/')?{path:a.path,namespace:'mock'}:null);b.onResolve({filter:/features\/finance\/actions$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mock,loader:'jsx',resolveDir:root}));}}]});
await writeFile(join(dir,'index.html'),'<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script type="module" src="/app.js"></script></html>');
const server=createServer(async(req,res)=>{try{const file=req.url==='/app.js'?'app.js':req.url==='/app.css'?'app.css':'index.html';res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(join(dir,file)));}catch{res.writeHead(500).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true, executablePath:process.env.HNTRIP_CHROMIUM_EXECUTABLE || undefined, args:['--no-sandbox']});const page=await browser.newPage();
try{
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByText('Jantar previsto',{exact:true}).waitFor();
 for(const [width,height,label] of [[1440,1000,'desktop'],[390,844,'mobile']]){
  await page.setViewportSize({width,height});await page.screenshot({path:join(dir,label+'.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow '+label);
 }
 const form=page.locator('form.expense-form');await form.locator('[name=description]').fill('Jantar teste');await form.locator('[name=categoryId]').selectOption('category');await form.locator('[name=date]').fill('2026-10-31');await form.locator('[name=amount]').fill('500');await form.getByRole('button',{name:'Salvar previsto'}).click();await form.getByRole('alert').waitFor();
 assert.equal(await form.locator('[name=description]').inputValue(),'Jantar teste');assert.equal(await form.locator('[name=amount]').inputValue(),'500');
 await form.getByRole('button',{name:'Salvar previsto'}).click();await page.waitForFunction(()=>window.submissions.length===2);let entries=await page.evaluate(()=>window.submissions);assert.equal(entries[0].idempotencyKey,entries[1].idempotencyKey);assert.ok(entries[0].idempotencyKey);
 await page.getByText('Confirmar gasto',{exact:true}).click();const confirm=page.locator('form.planned-confirm-form');await confirm.locator('[name=amount]').fill('420');await confirm.locator('[name=date]').fill('2026-11-01');await confirm.getByRole('button').click();await confirm.getByRole('alert').waitFor();assert.equal(await confirm.locator('[name=amount]').inputValue(),'420');assert.equal(await confirm.locator('[name=date]').inputValue(),'2026-11-01');await confirm.getByRole('button').click();await page.waitForFunction(()=>window.submissions.length===4);entries=await page.evaluate(()=>window.submissions);assert.equal(entries[2].idempotencyKey,entries[3].idempotencyKey);
 console.log('UI passed: desktop/mobile layout, action failure retains values and stable request keys. Screenshots: '+dir);
}finally{await browser.close();await new Promise(r=>server.close(r));}
