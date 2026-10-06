import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PiggyBank, ReceiptText, TrendingUp, WalletCards } from "lucide-react";
import { saveFinanceItemAmountAction } from "@/src/features/finance/actions";
import { TripRealtimeRefresh } from "@/src/components/trip-realtime-refresh";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { getSupabasePublicConfig } from "@/src/lib/supabase/config";

type Props={params:Promise<{tripId:string}>;searchParams:Promise<{actual?:string;error?:string}>};
export default async function FinancePage({params,searchParams}:Props){
 const {tripId}=await params; const notices=await searchParams; const member=await requireCurrentMember(); const supabase=await createServerSupabaseClient(); const supabaseConfig=getSupabasePublicConfig();
 const [{data:trip},{data:categories},{data:items},{data:expenseTotal,error:totalError}]=await Promise.all([
  supabase.from("trips").select("id,name,base_currency,budget").eq("id",tripId).eq("workspace_id",member.workspaceId).neq("status","archived").maybeSingle(),
  supabase.from("expense_categories").select("id,name,color,budget_limit").eq("trip_id",tripId).eq("workspace_id",member.workspaceId).is("archived_at",null).order("name"),
  supabase.from("finance_items").select("id,category_id,name,actual_amount,sort_order").eq("trip_id",tripId).eq("workspace_id",member.workspaceId).order("sort_order").order("name"),
  supabase.rpc("trip_expense_total",{p_trip_id:tripId,p_workspace_id:member.workspaceId})
 ]);
 if(!trip)notFound(); const money=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:trip.base_currency}).format(v); const spent=Number(expenseTotal??0); const budget=Number(trip.budget); const balance=budget-spent; const percent=budget>0?Math.min(spent/budget*100,100):0;
 const grouped=(categories??[]).map(c=>{const rows=(items??[]).filter(i=>i.category_id===c.id);const used=rows.reduce((s,i)=>s+Number(i.actual_amount??0),0);const limit=Number(c.budget_limit??0);return{...c,rows,used,limit,remaining:limit-used};});
 return <main className="app-page finance-page"><TripRealtimeRefresh tripId={trip.id} tables={["finance_items","expense_categories"]} supabaseConfig={supabaseConfig}/><div className="page-heading compact"><Link href={`/trips/${trip.id}`} className="back-link"><ArrowLeft size={18}/> {trip.name}</Link><p className="page-eyebrow">Financeiro</p><h1>Gastos da viagem</h1><p>Na viagem, preencha somente o valor. Cada item consome o limite da sua categoria.</p></div>
 {notices.actual==="saved"&&<p className="success-banner">Valor salvo.</p>}{notices.error&&<p className="app-form-message" role="alert">Não foi possível salvar o valor.</p>}{totalError&&<p className="app-form-message">O total financeiro não pôde ser atualizado agora.</p>}
 <section className="finance-summary"><article><WalletCards/><div><span>Orçamento</span><strong>{money(budget)}</strong></div></article><article><ReceiptText/><div><span>Gasto</span><strong>{totalError?"—":money(spent)}</strong></div></article><article className={balance<0?"negative":""}><PiggyBank/><div><span>Restante</span><strong>{totalError?"—":money(balance)}</strong></div></article><article><TrendingUp/><div><span>Utilizado</span><strong>{budget>0?`${(spent/budget*100).toFixed(1)}%`:"—"}</strong></div></article><div className="budget-progress"><span style={{width:`${totalError?0:percent}%`}}/></div></section>
 <section className="quick-finance-grid">{grouped.map(c=><article className="quick-finance-category" key={c.id}><header><div><span className="expense-category-dot" style={{background:c.color}}/><h2>{c.name}</h2></div><div className="category-budget"><span>Limite <strong>{money(c.limit)}</strong></span><span>Gasto <strong>{money(c.used)}</strong></span><span className={c.remaining<0?"negative":""}>Restante <strong>{money(c.remaining)}</strong></span></div></header><div className="quick-finance-items">{c.rows.map(item=><form action={saveFinanceItemAmountAction} className="quick-finance-item" key={item.id}><input type="hidden" name="tripId" value={trip.id}/><input type="hidden" name="itemId" value={item.id}/><label><span>{item.name}</span><div><span>R$</span><input name="amount" inputMode="decimal" required defaultValue={item.actual_amount==null?"":Number(item.actual_amount).toFixed(2).replace(".",",")} placeholder="0,00" aria-label={`Valor de ${item.name}`}/><button type="submit">Salvar</button></div></label></form>)}</div></article>)}</section>
 </main>;
}
