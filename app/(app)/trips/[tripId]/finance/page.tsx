import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleDollarSign, PiggyBank, ReceiptText, Trash2, TrendingUp, WalletCards } from "lucide-react";
import { ExpenseCategoryForm } from "@/src/features/finance/category-form";
import { ExpenseForm } from "@/src/features/finance/expense-form";
import { reverseExpenseAction } from "@/src/features/finance/actions";
import { TripRealtimeRefresh } from "@/src/components/trip-realtime-refresh";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { getSupabasePublicConfig } from "@/src/lib/supabase/config";
import { ListPagination } from "@/src/components/list-pagination";

export const dynamic = "force-dynamic";

type FinancePageProps = {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ category?: string; expense?: string; error?: string; q?: string; filterCategory?: string; page?: string }>;
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
  const [{ data: trip }, { data: categories }, { data: expenses, count }, { data: allAmounts }] = await Promise.all([
    supabase.from("trips").select("id, name, start_date, end_date, base_currency, budget").eq("id", tripId).eq("workspace_id", member.workspaceId).neq("status", "archived").maybeSingle(),
    supabase.from("expense_categories").select("id, name, color").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("archived_at", null).order("name", { ascending: true }).order("id", { ascending: true }),
    expenseQuery.order("expense_date", { ascending: false }).order("created_at", { ascending: false }).range((requestedPage - 1) * pageSize, requestedPage * pageSize - 1),
    supabase.from("expenses").select("amount").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("deleted_at", null),
  ]);
  if (!trip) notFound();

  const totalSpent = (allAmounts ?? []).reduce((sum, expense) => sum + Number(expense.amount), 0);
  const budget = Number(trip.budget);
  const balance = budget - totalSpent;
  const percent = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;
  const categoryById = new Map((categories ?? []).map((category) => [category.id, category]));
  const formatMoney = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: trip.base_currency }).format(value);
  const successMessage = notices.category === "added" ? "Categoria criada." : notices.expense === "added" ? "Gasto registrado." : notices.expense === "reversed" ? "Gasto estornado." : undefined;
  const total = count ?? 0; const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));

  return (
    <main className="app-page finance-page">
      <TripRealtimeRefresh tripId={trip.id} tables={["expenses", "expense_categories"]} supabaseConfig={supabaseConfig} />
      <div className="page-heading compact">
        <Link href={`/trips/${trip.id}`} className="back-link"><ArrowLeft aria-hidden="true" size={18} /> {trip.name}</Link>
        <p className="page-eyebrow">Financeiro</p>
        <h1>Orçamento e gastos</h1>
        <p>Acompanhe cada lançamento na moeda-base {trip.base_currency}.</p>
      </div>
      {successMessage && <p className="success-banner" role="status">{successMessage}</p>}
      {notices.error && <p className="app-form-message" role="alert">Não foi possível estornar o gasto.</p>}

      <section className="finance-summary" aria-label="Resumo financeiro">
        <article><WalletCards aria-hidden="true" /><div><span>Orçamento</span><strong>{formatMoney(budget)}</strong></div></article>
        <article><ReceiptText aria-hidden="true" /><div><span>Total gasto</span><strong>{formatMoney(totalSpent)}</strong></div></article>
        <article className={balance < 0 ? "negative" : ""}><PiggyBank aria-hidden="true" /><div><span>Saldo</span><strong>{formatMoney(balance)}</strong></div></article>
        <article><TrendingUp aria-hidden="true" /><div><span>Utilizado</span><strong>{budget > 0 ? `${((totalSpent / budget) * 100).toFixed(1)}%` : "—"}</strong></div></article>
        <div className="budget-progress" aria-label={`${percent.toFixed(0)}% do orçamento utilizado`}><span style={{ width: `${percent}%` }} /></div>
      </section>

      <div className="finance-layout">
        <section className="finance-main">
          <div className="section-heading"><div><p className="page-eyebrow">Novo lançamento</p><h2>Registrar gasto</h2></div><CircleDollarSign aria-hidden="true" /></div>
          <div className="form-surface finance-form-surface"><ExpenseForm tripId={trip.id} categories={categories ?? []} /></div>

          <div className="section-heading expenses-heading"><div><p className="page-eyebrow">Histórico</p><h2>Lançamentos</h2></div><ReceiptText aria-hidden="true" /></div>
          <form className="list-filters compact-filters" method="get"><label><span>Buscar gastos</span><input defaultValue={q} maxLength={80} name="q" placeholder="Descrição ou estabelecimento" /></label><label><span>Categoria</span><select defaultValue={filterCategory} name="filterCategory"><option value="">Todas</option>{categories?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button className="app-secondary-button" type="submit">Filtrar</button>{(q || filterCategory) && <Link href={`/trips/${trip.id}/finance`}>Limpar</Link>}</form>
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
          <ListPagination page={page} total={total} pageSize={pageSize} pathname={`/trips/${trip.id}/finance`} params={{ q, filterCategory }} />
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
