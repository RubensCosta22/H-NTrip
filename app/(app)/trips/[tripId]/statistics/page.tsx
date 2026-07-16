import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Camera, CheckCircle2, CircleDollarSign, FileText, MapPin, Route, Users } from "lucide-react";
import { TripRealtimeRefresh } from "@/src/components/trip-realtime-refresh";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { getSupabasePublicConfig } from "@/src/lib/supabase/config";

export const dynamic = "force-dynamic";
type StatisticsPageProps = { params: Promise<{ tripId: string }> };

export default async function StatisticsPage({ params }: StatisticsPageProps) {
  const { tripId } = await params;
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const supabaseConfig = getSupabasePublicConfig();
  const [
    { data: trip },
    { count: participantCount, error: participantError },
    { data: days, error: dayError },
    { data: activities, error: activityError },
    { data: categories, error: categoryError },
    { data: expenses, error: expenseError },
    { data: checklistItems, error: checklistError },
    { data: documents, error: documentError },
    { data: photos, error: photoError },
  ] = await Promise.all([
    supabase.from("trips").select("id, name, destination, start_date, end_date, base_currency, budget").eq("id", tripId).eq("workspace_id", member.workspaceId).neq("status", "archived").maybeSingle(),
    supabase.from("trip_participants").select("id", { count: "exact", head: true }).eq("trip_id", tripId).eq("workspace_id", member.workspaceId),
    supabase.from("itinerary_days").select("id, day_date, title").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).order("day_date", { ascending: true }).order("id", { ascending: true }),
    supabase.from("itinerary_activities").select("id, itinerary_day_id, location_latitude, location_longitude").eq("trip_id", tripId).eq("workspace_id", member.workspaceId),
    supabase.from("expense_categories").select("id, name, color").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("archived_at", null),
    supabase.from("expenses").select("category_id, amount").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("deleted_at", null),
    supabase.from("checklist_items").select("is_completed").eq("trip_id", tripId).eq("workspace_id", member.workspaceId),
    supabase.from("trip_documents").select("expires_on").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("archived_at", null),
    supabase.from("trip_photos").select("size_bytes").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("archived_at", null),
  ]);
  if (!trip) notFound();

  const start = new Date(`${trip.start_date}T00:00:00Z`);
  const end = new Date(`${trip.end_date}T00:00:00Z`);
  const durationDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const budget = Number(trip.budget);
  const totalSpent = (expenses ?? []).reduce((sum, expense) => sum + Number(expense.amount), 0);
  const balance = budget - totalSpent;
  const budgetPercent = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;
  const formatMoney = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: trip.base_currency }).format(value);

  const categoryMap = new Map((categories ?? []).map((category) => [category.id, { ...category, total: 0 }]));
  for (const expense of expenses ?? []) {
    const category = categoryMap.get(expense.category_id);
    if (category) category.total += Number(expense.amount);
  }
  const categoryTotals = [...categoryMap.values()].filter((category) => category.total > 0).sort((a, b) => b.total - a.total);
  const largestCategory = categoryTotals[0]?.total ?? 0;

  const activityByDay = new Map<string, number>();
  for (const activity of activities ?? []) activityByDay.set(activity.itinerary_day_id, (activityByDay.get(activity.itinerary_day_id) ?? 0) + 1);
  const maxDayActivities = Math.max(1, ...(days ?? []).map((day) => activityByDay.get(day.id) ?? 0));
  const mappedLocations = activities?.filter((activity) => activity.location_latitude !== null && activity.location_longitude !== null).length ?? 0;

  const checklistTotal = checklistItems?.length ?? 0;
  const checklistDone = checklistItems?.filter((item) => item.is_completed).length ?? 0;
  const checklistPercent = checklistTotal ? (checklistDone / checklistTotal) * 100 : 0;
  const today = new Date().toISOString().slice(0, 10);
  const warningDate = new Date(); warningDate.setUTCDate(warningDate.getUTCDate() + 60);
  const warningLimit = warningDate.toISOString().slice(0, 10);
  const expiredDocuments = documents?.filter((document) => document.expires_on && document.expires_on < today).length ?? 0;
  const expiringDocuments = documents?.filter((document) => document.expires_on && document.expires_on >= today && document.expires_on <= warningLimit).length ?? 0;
  const photoBytes = (photos ?? []).reduce((sum, photo) => sum + Number(photo.size_bytes), 0);
  const hasError = Boolean(participantError || dayError || activityError || categoryError || expenseError || checklistError || documentError || photoError);

  return <main className="app-page statistics-page">
    <TripRealtimeRefresh tripId={trip.id} tables={["expenses", "checklist_items"]} supabaseConfig={supabaseConfig} />
    <div className="page-heading compact"><Link href={`/trips/${trip.id}`} className="back-link"><ArrowLeft aria-hidden="true" size={18} /> {trip.name}</Link><p className="page-eyebrow">Panorama da viagem</p><h1>Estatísticas</h1><p><MapPin aria-hidden="true" size={18} /> {trip.destination} · {durationDays} {durationDays === 1 ? "dia" : "dias"}</p></div>
    {hasError && <p className="dashboard-warning" role="status">Alguns indicadores não puderam ser atualizados agora.</p>}

    <section className="statistics-metrics" aria-label="Indicadores principais">
      <article><CalendarDays aria-hidden="true" /><div><strong>{durationDays}</strong><span>dias de viagem</span></div></article>
      <article><Route aria-hidden="true" /><div><strong>{activities?.length ?? 0}</strong><span>atividades</span></div></article>
      <article><MapPin aria-hidden="true" /><div><strong>{mappedLocations}</strong><span>locais no mapa</span></div></article>
      <article><Users aria-hidden="true" /><div><strong>{participantCount ?? 0}</strong><span>participantes</span></div></article>
      <article><Camera aria-hidden="true" /><div><strong>{photos?.length ?? 0}</strong><span>fotos privadas</span></div></article>
      <article><FileText aria-hidden="true" /><div><strong>{documents?.length ?? 0}</strong><span>documentos ativos</span></div></article>
    </section>

    <div className="statistics-layout">
      <section className="statistics-panel finance-statistics">
        <div className="section-heading"><div><p className="page-eyebrow">Orçamento</p><h2>Saúde financeira</h2></div><CircleDollarSign aria-hidden="true" /></div>
        <div className="statistics-money"><div><span>Planejado</span><strong>{formatMoney(budget)}</strong></div><div><span>Gasto</span><strong>{formatMoney(totalSpent)}</strong></div><div className={balance < 0 ? "negative" : ""}><span>Saldo</span><strong>{formatMoney(balance)}</strong></div></div>
        <div className="statistics-progress" aria-label={`${budgetPercent.toFixed(0)}% do orçamento utilizado`}><span style={{ width: `${budgetPercent}%` }} /></div>
        <div className="category-statistics">{categoryTotals.length ? categoryTotals.map((category) => <div key={category.id}><div><span><i style={{ background: category.color }} />{category.name}</span><strong>{formatMoney(category.total)}</strong></div><div className="stat-bar"><span style={{ width: `${(category.total / largestCategory) * 100}%`, background: category.color }} /></div></div>) : <p>Nenhum gasto registrado.</p>}</div>
      </section>

      <section className="statistics-panel readiness-statistics">
        <div className="section-heading"><div><p className="page-eyebrow">Preparação</p><h2>Prontidão</h2></div><CheckCircle2 aria-hidden="true" /></div>
        <div className="readiness-score"><strong>{checklistPercent.toFixed(0)}%</strong><span>do checklist concluído</span></div>
        <div className="statistics-progress checklist"><span style={{ width: `${checklistPercent}%` }} /></div>
        <div className="readiness-details"><p><strong>{checklistDone}</strong> de {checklistTotal} itens concluídos</p><p className={expiredDocuments ? "negative" : ""}><strong>{expiredDocuments}</strong> documentos vencidos</p><p className={expiringDocuments ? "warning" : ""}><strong>{expiringDocuments}</strong> vencem em até 60 dias</p></div>
      </section>

      <section className="statistics-panel itinerary-statistics">
        <div className="section-heading"><div><p className="page-eyebrow">Ritmo</p><h2>Atividades por dia</h2></div><Route aria-hidden="true" /></div>
        <div className="day-statistics">{days?.length ? days.map((day, index) => { const count = activityByDay.get(day.id) ?? 0; return <div key={day.id}><span>Dia {index + 1}<small>{day.title || day.day_date}</small></span><div className="stat-bar"><i style={{ width: `${(count / maxDayActivities) * 100}%` }} /></div><strong>{count}</strong></div>; }) : <p>Nenhum dia adicionado ao roteiro.</p>}</div>
      </section>

      <section className="statistics-panel memory-statistics">
        <div className="section-heading"><div><p className="page-eyebrow">Memórias</p><h2>Álbum privado</h2></div><Camera aria-hidden="true" /></div>
        <div className="memory-number"><strong>{photos?.length ?? 0}</strong><span>fotos · {(photoBytes / 1024 / 1024).toFixed(1)} MB</span></div>
        <Link className="app-secondary-link" href={`/trips/${trip.id}/photos`}>Abrir álbum</Link>
      </section>
    </div>
  </main>;
}
