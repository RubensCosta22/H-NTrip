import Link from "next/link";
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, FileWarning, Plane, ShieldCheck } from "lucide-react";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type AlertItem = {
  id: string;
  priority: 0 | 1 | 2;
  kind: "trip" | "checklist" | "document";
  title: string;
  description: string;
  date: string;
  href: string;
};

const formatDate = (date: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const addDays = (date: Date, days: number) => { const result = new Date(date); result.setUTCDate(result.getUTCDate() + days); return result.toISOString().slice(0, 10); };

export default async function AlertsPage() {
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const [{ data: trips, error: tripError }, { data: checklistItems, error: checklistError }, { data: documents, error: documentError }] = await Promise.all([
    supabase.from("trips").select("id, name, destination, start_date, end_date, status").eq("workspace_id", member.workspaceId).neq("status", "archived").order("start_date", { ascending: true }),
    supabase.from("checklist_items").select("id, trip_id, title, due_date").eq("workspace_id", member.workspaceId).eq("is_completed", false).not("due_date", "is", null).order("due_date", { ascending: true }).limit(200),
    supabase.from("trip_documents").select("id, trip_id, title, expires_on").eq("workspace_id", member.workspaceId).is("archived_at", null).not("expires_on", "is", null).order("expires_on", { ascending: true }).limit(200),
  ]);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const sevenDays = addDays(now, 7);
  const thirtyDays = addDays(now, 30);
  const sixtyDays = addDays(now, 60);
  const tripById = new Map((trips ?? []).map((trip) => [trip.id, trip]));
  const alerts: AlertItem[] = [];

  for (const trip of trips ?? []) {
    if (trip.status === "ongoing") alerts.push({ id: `trip-${trip.id}`, priority: 2, kind: "trip", title: `${trip.name} está em andamento`, description: `${trip.destination} · até ${formatDate(trip.end_date)}`, date: today, href: `/trips/${trip.id}` });
    else if (trip.start_date >= today && trip.start_date <= thirtyDays) alerts.push({ id: `trip-${trip.id}`, priority: 2, kind: "trip", title: `${trip.name} está se aproximando`, description: `${trip.destination} · começa em ${formatDate(trip.start_date)}`, date: trip.start_date, href: `/trips/${trip.id}` });
  }
  for (const item of checklistItems ?? []) {
    if (!item.due_date || item.due_date > sevenDays) continue;
    const trip = tripById.get(item.trip_id);
    if (!trip) continue;
    const overdue = item.due_date < today;
    alerts.push({ id: `checklist-${item.id}`, priority: overdue ? 0 : 1, kind: "checklist", title: overdue ? `Checklist atrasado: ${item.title}` : `Prazo próximo: ${item.title}`, description: `${trip.name} · ${overdue ? "venceu" : "vence"} em ${formatDate(item.due_date)}`, date: item.due_date, href: `/trips/${item.trip_id}/checklist` });
  }
  for (const document of documents ?? []) {
    if (!document.expires_on || document.expires_on > sixtyDays) continue;
    const trip = tripById.get(document.trip_id);
    if (!trip) continue;
    const expired = document.expires_on < today;
    alerts.push({ id: `document-${document.id}`, priority: expired ? 0 : 1, kind: "document", title: expired ? `Documento vencido: ${document.title}` : `Validade próxima: ${document.title}`, description: `${trip.name} · ${expired ? "venceu" : "vence"} em ${formatDate(document.expires_on)}`, date: document.expires_on, href: `/trips/${document.trip_id}/documents` });
  }
  alerts.sort((a, b) => a.priority - b.priority || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const critical = alerts.filter((alert) => alert.priority === 0).length;
  const warnings = alerts.filter((alert) => alert.priority === 1).length;
  const hasError = Boolean(tripError || checklistError || documentError);

  return <main className="app-page alerts-page">
    <div className="page-heading compact"><p className="page-eyebrow">Atenção necessária</p><h1>Central de alertas</h1><p>Uma visão privada de prazos, documentos e viagens que estão chegando.</p></div>
    {hasError && <p className="dashboard-warning" role="status">Alguns alertas não puderam ser atualizados agora.</p>}
    <section className="alert-summary" aria-label="Resumo de alertas"><article className={critical ? "critical" : ""}><AlertTriangle aria-hidden="true" /><div><strong>{critical}</strong><span>itens atrasados ou vencidos</span></div></article><article className={warnings ? "warning" : ""}><CalendarClock aria-hidden="true" /><div><strong>{warnings}</strong><span>prazos próximos</span></div></article><article><Bell aria-hidden="true" /><div><strong>{alerts.length}</strong><span>alertas ativos</span></div></article></section>
    <section className="alert-list" aria-label="Alertas ativos">{alerts.length ? alerts.map((alert) => { const Icon = alert.kind === "trip" ? Plane : alert.kind === "checklist" ? CheckCircle2 : FileWarning; return <Link className={`alert-row priority-${alert.priority}`} href={alert.href} key={alert.id}><span className="alert-row-icon"><Icon aria-hidden="true" /></span><span><strong>{alert.title}</strong><small>{alert.description}</small></span><span className="alert-action">Revisar</span></Link>; }) : <div className="all-clear"><ShieldCheck aria-hidden="true" /><h2>Tudo em ordem</h2><p>Nenhum prazo ou validade exige atenção agora.</p></div>}</section>
  </main>;
}
