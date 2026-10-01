import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleDollarSign, PiggyBank, ReceiptText, Trash2, TrendingUp, WalletCards } from "lucide-react";
import { ExpenseCategoryForm } from "@/src/features/finance/category-form";
import { ConfirmExpenseForm } from "@/src/features/finance/confirm-expense-form";
import { ExpenseForm } from "@/src/features/finance/expense-form";
import { cancelPlannedExpenseAction, reverseExpenseAction } from "@/src/features/finance/actions";
import { TripRealtimeRefresh } from "@/src/components/trip-realtime-refresh";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { getSupabasePublicConfig } from "@/src/lib/supabase/config";
import { ListPagination } from "@/src/components/list-pagination";

export const dynamic = "force-dynamic";

type FinancePageProps = {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ category?: string; expense?: string; error?: string; q?: string; filterCategory?: string; page?: string; plannedPage?: string }>;
};

export default async function FinancePage({ params, searchParams }: FinancePageProps) {
  const { tripId } = await params;
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const supabaseConfig = getSupabasePublicConfig();
  const notices = await searchParams; const q = (notices.q ?? "").replace(/[,%()]/g, " ").trim().slice(0, 80);
  const filterCategory = /^[0-9a-f-]{36}$/i.test(notices.filterCategory ?? "") ? notices.filterCategory! : "";
  const pageSize = 20; const requestedPage = Math.max(1, Number.parseInt(notices.page ?? "1", 10) || 1);
  let expenseQuery = supabase.from("expenses").select("id, category_id, description, merchant, expense_date, amount, currency, created_at", { count: "exact" }).eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("deleted_at", null);
  if (q) expenseQuery = expenseQuery.or(`description.ilike.%${q}%,merchant.ilike.%${q}%`);
  if (filterCategory) expenseQuery = expenseQuery.eq("category_id", filterCategory);
  const requestedPlannedPage = Math.max(1, Number.parseInt(notices.plannedPage ?? "1", 10) || 1);
  let planQuery = supabase.from("planned_expenses").select("id, description, merchant, category_id, planned_date, planned_amount, confirmed_expense_id, payment:expenses!planned_expenses_payment_fk(amount, expense_date, deleted_at)", { count: "exact" }).eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("cancelled_at", null);
  if (q) planQuery = planQuery.or(`description.ilike.%${q}%,merchant.ilike.%${q}%`);
  if (filterCategory) planQuery = planQuery.eq("category_id", filterCategory);
  const [{ data: trip }, { data: categories, error: categoryError }, { data: expenses, count, error: expenseError }, { data: summary, error: summaryError }, { data: plans, count: planCount, error: planError }] = await Promise.all([
    supabase.from("trips").select("id, name, start_date, end_date, base_currency, budget").eq("id", tripId).eq("workspace_id", member.workspaceId).neq("status", "archived").maybeSingle(),
    supabase.from("expense_categories").select("id, name, color").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("archived_at", null).order("name", { ascending: true }).order("id", { ascending: true }),
    expenseQuery.order("expense_date", { ascending: false }).order("created_at", { ascending: false }).range((requestedPage - 1) * pageSize, requestedPage * pageSize - 1),
    supabase.rpc("trip_finance_summary", { target_trip_id: tripId }),
    planQuery.order("planned_date", { ascending: true }).order("id", { ascending: true }).range((requestedPlannedPage - 1) * pageSize, requestedPlannedPage * pageSize - 1),
  ]);
  if (!trip) notFound();

  if (categoryError || expenseError || summaryError || planError || !summary) {
    console.error(JSON.stringify({ action: "finance.read", outcome: "error", code: (categoryError || expenseError || summaryError || planError)?.code }));
    return <main className="app-page finance-page"><h1>Orçamento e gastos</h1><p role="alert">Não foi possível carregar os valores. Recarregue a página quando a conexão estiver disponível.</p><Link href={`/trips/${tripId}/finance`}>Tentar novamente</Link></main>;
  }
  const totalSpent = Number(summary.actual);
  const plannedTotal = Number(summary.planned);
  const pendingTotal = Number(summary.pending);
  const projected = Number(summary.projected);
  const projectedMargin = Number(summary.margin);
  const budget = Number(trip.budget);
  const balance = budget - totalSpent;
  const percent = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;
  const categoryById = new Map((categories ?? []).map((category) => [category.id, category]));
  const formatMoney = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: trip.base_currency }).format(value);
  const successMessage = notices.category === "added" ? "Categoria criada." : notices.expense === "added" ? "Gasto registrado." : notices.expense === "reversed" ? "Gasto estornado. Se tinha previsão, ela voltou a ficar pendente." : notices.expense === "planned" ? "Previsão salva." : notices.expense === "confirmed" ? "Valor realizado confirmado. Estimativa preservada." : notices.expense === "cancelled" ? "Previsão cancelada." : undefined;
  const total = count ?? 0; const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));

  return (
    <main className="app-page finance-page">
      <TripRealtimeRefresh tripId={trip.id} tables={["expenses", "expense_categories", "planned_expenses"]} supabaseConfig={supabaseConfig} />
      <div className="page-heading compact">
        <Link href={`/trips/${trip.id}`} className="back-link"><ArrowLeft aria-hidden="true" size={18} /> {trip.name}</Link>
        <p className="page-eyebrow">Financeiro</p>
        <h1>Orçamento e gastos</h1>
        <p>Acompanhe cada lançamento na moeda-base {trip.base_currency}.</p>
      </div>
      {successMessage && <p className="success-banner" role="status">{successMessage}</p>}
      {notices.error && <p className="app-form-message" role="alert">Não foi possível concluir a operação. Atualize a página e confira o lançamento.</p>}

      <section className="finance-summary" aria-label="Resumo financeiro">
        <article><WalletCards aria-hidden="true" /><div><span>Orçamento</span><strong>{formatMoney(budget)}</strong></div></article>
        <article><ReceiptText aria-hidden="true" /><div><span>Realizado</span><strong>{formatMoney(totalSpent)}</strong></div></article>
        <article className={balance < 0 ? "negative" : ""}><PiggyBank aria-hidden="true" /><div><span>Saldo atual</span><strong>{formatMoney(balance)}</strong></div></article>
        <article><TrendingUp aria-hidden="true" /><div><span>Previsto original</span><strong>{formatMoney(plannedTotal)}</strong></div></article>
        <article><ReceiptText aria-hidden="true" /><div><span>Ainda previsto</span><strong>{formatMoney(pendingTotal)}</strong></div></article>
        <article><TrendingUp aria-hidden="true" /><div><span>Projeção final</span><strong>{formatMoney(projected)}</strong></div></article>
        <article className={projectedMargin < 0 ? "negative" : ""}><PiggyBank aria-hidden="true" /><div><span>Margem projetada</span><strong>{formatMoney(projectedMargin)}</strong></div></article>
        <div className="budget-progress" aria-label={`${percent.toFixed(0)}% do orçamento utilizado`}><span style={{ width: `${percent}%` }} /></div>
      </section>

      <div className="finance-layout">
        <section className="finance-main">
          <div className="section-heading"><div><p className="page-eyebrow">Novo lançamento</p><h2>Adicionar previsto ou realizado</h2></div><CircleDollarSign aria-hidden="true" /></div>
          <div className="form-surface finance-form-surface"><ExpenseForm tripId={trip.id} categories={categories ?? []} /></div>

          <div className="section-heading expenses-heading"><div><p className="page-eyebrow">Histórico</p><h2>Lançamentos</h2></div><ReceiptText aria-hidden="true" /></div>
          <form className="list-filters compact-filters" method="get"><label><span>Buscar gastos</span><input defaultValue={q} maxLength={80} name="q" placeholder="Descrição ou estabelecimento" /></label><label><span>Categoria</span><select defaultValue={filterCategory} name="filterCategory"><option value="">Todas</option>{categories?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button className="app-secondary-button" type="submit">Filtrar</button>{(q || filterCategory) && <Link href={`/trips/${trip.id}/finance`}>Limpar</Link>}</form>
          <section className="planned-expense-section" aria-label="Despesas previstas">
            <h2>Previstos e confirmações</h2>
            <p className="form-hint">A projeção soma o realizado ao que ainda falta pagar. Para corrigir uma previsão pendente, cancele e cadastre novamente. Custos em Locais são referências e não são somados aqui.</p>
            <div className="planned-expense-list">{plans?.length ? plans.map((plan) => {
              const payment = (Array.isArray(plan.payment) ? plan.payment[0] : plan.payment) as { amount: string | number; expense_date: string; deleted_at: string | null } | null;
              const confirmed = payment && !payment.deleted_at;
              return <article className="planned-expense-card" key={plan.id}>
                <header><div><h3>{plan.description}</h3><p>{categoryById.get(plan.category_id)?.name ?? "Categoria"}{plan.merchant && ` · ${plan.merchant}`}</p></div><span className={`planned-status ${confirmed ? "confirmed" : ""}`}>{confirmed ? "Confirmado" : "Previsto"}</span></header>
                <p>Data prevista: <time dateTime={plan.planned_date}>{new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${plan.planned_date}T00:00:00Z`))}</time></p>
                <dl className="planned-values"><div><dt>Previsto</dt><dd>{formatMoney(Number(plan.planned_amount))}</dd></div><div><dt>Realizado</dt><dd>{confirmed ? formatMoney(Number(payment.amount)) : "Ainda não pago"}</dd></div>{confirmed && <div><dt>Diferença (real − previsto)</dt><dd>{formatMoney(Number(payment.amount) - Number(plan.planned_amount))}</dd></div>}</dl>
                {confirmed ? <p className="form-hint">Pagamento em {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${payment.expense_date}T00:00:00Z`))}. Para corrigir, estorne o pagamento no histórico e confirme novamente.</p> : <div className="planned-actions"><details><summary>Confirmar gasto</summary><ConfirmExpenseForm tripId={trip.id} planId={plan.id} amount={String(plan.planned_amount)} date={plan.planned_date} /></details><form action={cancelPlannedExpenseAction}><input type="hidden" name="tripId" value={trip.id} /><input type="hidden" name="expenseId" value={plan.id} /><button className="app-secondary-button" type="submit">Cancelar previsão</button></form></div>}
              </article>;
            }) : <p className="form-hint">Nenhuma previsão encontrada. Escolha Previsto no formulário para começar.</p>}</div>
            <div className="planned-pagination"><span>{planCount ?? 0} previsões</span>{requestedPlannedPage > 1 && <Link href={`?${new URLSearchParams({ q, filterCategory, page: String(page), plannedPage: String(requestedPlannedPage - 1) })}`}>Previsões anteriores</Link>}{requestedPlannedPage * pageSize < (planCount ?? 0) && <Link href={`?${new URLSearchParams({ q, filterCategory, page: String(page), plannedPage: String(requestedPlannedPage + 1) })}`}>Próximas previsões</Link>}</div>
          </section>
          <h2>Gastos realizados</h2>
          <div className="expense-list">
            {expenses?.length ? expenses.map((expense) => {
              const category = categoryById.get(expense.category_id);
              return (
                <article className="expense-row" key={expense.id}>
                  <span className="expense-category-dot" style={{ background: category?.color ?? "#43C6D9" }} />
                  <div><strong>{expense.description}</strong><p>{category?.name ?? "Categoria"}{expense.merchant && ` · ${expense.merchant}`}</p></div>
                  <time dateTime={expense.expense_date}>{new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${expense.expense_date}T00:00:00Z`))}</time>
                  <strong className="expense-amount">{formatMoney(Number(expense.amount))}</strong>
                  <form action={reverseExpenseAction}><input name="tripId" type="hidden" value={trip.id} /><input name="expenseId" type="hidden" value={expense.id} /><button aria-label={`Estornar ${expense.description}`} title={`Estornar ${expense.description}`} type="submit"><Trash2 aria-hidden="true" size={17} /></button></form>
                </article>
              );
            }) : <div className="expenses-empty"><ReceiptText aria-hidden="true" /><p>{q || filterCategory ? "Nenhum gasto corresponde aos filtros." : "Nenhum gasto registrado."}</p></div>}
          </div>
          <ListPagination page={page} total={total} pageSize={pageSize} pathname={`/trips/${trip.id}/finance`} params={{ q, filterCategory, plannedPage: String(requestedPlannedPage) }} />
        </section>

        <aside className="category-panel">
          <div className="section-heading"><div><p className="page-eyebrow">Organização</p><h2>Categorias</h2></div></div>
          <ExpenseCategoryForm tripId={trip.id} />
          <div className="category-list">{categories?.map((category) => <div key={category.id}><span style={{ background: category.color }} />{category.name}</div>)}</div>
        </aside>
      </div>
    </main>
  );
}
