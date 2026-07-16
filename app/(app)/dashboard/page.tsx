import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  PiggyBank,
  Plane,
  Plus,
  ReceiptText,
  Route,
  WalletCards,
} from "lucide-react";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { TripRealtimeRefresh } from "@/src/components/trip-realtime-refresh";
import { getSupabasePublicConfig } from "@/src/lib/supabase/config";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

export default async function DashboardPage() {
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const supabaseConfig = getSupabasePublicConfig();
  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select("id, name, destination, start_date, end_date, status, base_currency, budget")
    .eq("workspace_id", member.workspaceId)
    .neq("status", "archived")
    .order("start_date", { ascending: true })
    .order("id", { ascending: true })
    .limit(100);

  if (tripsError) {
    return (
      <main className="app-page dashboard-page">
        <section className="dashboard-error" role="alert">
          <Plane aria-hidden="true" />
          <h1>Não foi possível carregar sua visão geral</h1>
          <p>Tente novamente em alguns instantes ou acesse a lista de viagens.</p>
          <Link className="app-secondary-link" href="/trips">Ver viagens</Link>
        </section>
      </main>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const activeTrips = trips ?? [];
  const currentTrip = activeTrips.find((trip) => trip.status === "ongoing")
    ?? activeTrips.find((trip) => trip.end_date >= today && trip.status !== "completed");

  if (!currentTrip) {
    return (
      <main className="app-page dashboard-page">
        <section className="dashboard-hero">
          <div>
            <p className="page-eyebrow">Bem-vinda ao H&amp;NTrip</p>
            <h1>Todo o planejamento,<br />em um só horizonte.</h1>
            <p>{activeTrips.length ? "Não há uma próxima viagem planejada. Que tal abrir um novo horizonte?" : "Crie sua primeira viagem e transforme ideias em um plano compartilhado."}</p>
            <Link className="app-primary-link" href="/trips/new"><Plus aria-hidden="true" size={18} /> Criar viagem <ArrowRight aria-hidden="true" size={18} /></Link>
          </div>
        </section>
      </main>
    );
  }

  const [{ data: expenses, error: expensesError }, { data: checklistItems, error: checklistError }, { count: activityCount, error: activitiesError }] = await Promise.all([
    supabase.from("expenses").select("amount").eq("workspace_id", member.workspaceId).eq("trip_id", currentTrip.id).is("deleted_at", null),
    supabase.from("checklist_items").select("is_completed").eq("workspace_id", member.workspaceId).eq("trip_id", currentTrip.id),
    supabase.from("itinerary_activities").select("id", { count: "exact", head: true }).eq("workspace_id", member.workspaceId).eq("trip_id", currentTrip.id),
  ]);

  const totalSpent = (expenses ?? []).reduce((sum, expense) => sum + Number(expense.amount), 0);
  const budget = Number(currentTrip.budget);
  const balance = budget - totalSpent;
  const totalItems = checklistItems?.length ?? 0;
  const pendingItems = checklistItems?.filter((item) => !item.is_completed).length ?? 0;
  const completedItems = totalItems - pendingItems;
  const checklistPercent = totalItems ? (completedItems / totalItems) * 100 : 0;
  const formatMoney = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: currentTrip.base_currency }).format(value);
  const hasSummaryError = Boolean(expensesError || checklistError || activitiesError);
  const statusLabel = currentTrip.status === "ongoing" ? "Em andamento" : currentTrip.status === "draft" ? "Rascunho" : "Próxima viagem";

  return (
    <main className="app-page dashboard-page dashboard-active">
      <TripRealtimeRefresh tripId={currentTrip.id} tables={["expenses", "checklist_items"]} supabaseConfig={supabaseConfig} />
      <section className="dashboard-trip-hero">
        <div className="dashboard-trip-copy">
          <div className="dashboard-trip-kicker"><span>{statusLabel}</span><span>{activeTrips.length} {activeTrips.length === 1 ? "viagem ativa" : "viagens ativas"}</span></div>
          <p className="page-eyebrow">Seu próximo horizonte</p>
          <h1>{currentTrip.name}</h1>
          <p className="dashboard-destination"><MapPin aria-hidden="true" size={18} /> {currentTrip.destination}</p>
          <p className="dashboard-dates"><CalendarDays aria-hidden="true" size={18} /> {formatDate(currentTrip.start_date)} — {formatDate(currentTrip.end_date)}</p>
          <div className="dashboard-hero-actions">
            <Link className="app-primary-link" href={`/trips/${currentTrip.id}`}>Abrir planejamento <ArrowRight aria-hidden="true" size={18} /></Link>
            <Link className="app-secondary-link" href="/trips">Todas as viagens</Link>
          </div>
        </div>
      </section>

      {hasSummaryError && <p className="dashboard-warning" role="status">Alguns indicadores não puderam ser atualizados agora.</p>}

      <section className="dashboard-metrics" aria-label="Resumo da próxima viagem">
        <article><WalletCards aria-hidden="true" /><div><span>Orçamento</span><strong>{formatMoney(budget)}</strong></div></article>
        <article><ReceiptText aria-hidden="true" /><div><span>Total gasto</span><strong>{expensesError ? "—" : formatMoney(totalSpent)}</strong></div></article>
        <article className={!expensesError && balance < 0 ? "negative" : ""}><PiggyBank aria-hidden="true" /><div><span>Saldo</span><strong>{expensesError ? "—" : formatMoney(balance)}</strong></div></article>
        <article><ClipboardCheck aria-hidden="true" /><div><span>Pendências</span><strong>{checklistError ? "—" : pendingItems}</strong></div></article>
      </section>

      <section className="dashboard-workspace" aria-label="Áreas do planejamento">
        <article className="dashboard-module-card">
          <div className="module-icon"><Route aria-hidden="true" /></div>
          <div><p className="page-eyebrow">Roteiro</p><h2>{activitiesError ? "Atividades" : `${activityCount ?? 0} ${(activityCount ?? 0) === 1 ? "atividade" : "atividades"}`}</h2><p>Horários, locais e a ordem de cada experiência.</p></div>
          <Link href={`/trips/${currentTrip.id}/itinerary`}>Abrir roteiro <ArrowRight aria-hidden="true" size={17} /></Link>
        </article>

        <article className="dashboard-module-card">
          <div className="module-icon finance"><ReceiptText aria-hidden="true" /></div>
          <div><p className="page-eyebrow">Financeiro</p><h2>{expensesError ? "Orçamento" : `${budget > 0 ? Math.round((totalSpent / budget) * 100) : 0}% utilizado`}</h2><p>Orçamento, lançamentos e saldo da viagem.</p></div>
          <Link href={`/trips/${currentTrip.id}/finance`}>Ver finanças <ArrowRight aria-hidden="true" size={17} /></Link>
        </article>

        <article className="dashboard-module-card">
          <div className="module-icon checklist"><CheckCircle2 aria-hidden="true" /></div>
          <div><p className="page-eyebrow">Checklist</p><h2>{checklistError ? "Pendências" : `${checklistPercent.toFixed(0)}% concluído`}</h2><p>{checklistError ? "Organize tudo antes de partir." : pendingItems ? `${pendingItems} ${pendingItems === 1 ? "item ainda precisa" : "itens ainda precisam"} de atenção.` : totalItems ? "Tudo pronto para partir." : "Crie a primeira lista de preparação."}</p></div>
          <Link href={`/trips/${currentTrip.id}/checklist`}>Ver checklist <ArrowRight aria-hidden="true" size={17} /></Link>
        </article>
      </section>
    </main>
  );
}
