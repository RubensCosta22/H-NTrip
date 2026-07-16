import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowLeft, Camera, CheckCircle2, CircleDollarSign, FileText, History, Plane, Route, UserRound, Users } from "lucide-react";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { ListPagination } from "@/src/components/list-pagination";

export const dynamic = "force-dynamic";
type ActivityPageProps = { params: Promise<{ tripId: string }>; searchParams: Promise<{ q?: string; module?: string; page?: string }> };
type AuditMetadata = { trip_id?: string; direction?: string; category?: string; has_coordinates?: boolean };

const actionLabels: Record<string, string> = {
  "trip.created": "Viagem criada",
  "trip.updated": "Informações da viagem atualizadas",
  "trip.archived": "Viagem arquivada",
  "trip.participant_added": "Participante adicionado",
  "trip.participant_removed": "Participante removido",
  "itinerary.day_added": "Dia adicionado ao roteiro",
  "itinerary.activity_added": "Atividade adicionada ao roteiro",
  "itinerary.activity_moved": "Atividade reordenada",
  "itinerary.activity_removed": "Atividade removida",
  "finance.category_added": "Categoria financeira criada",
  "finance.expense_added": "Gasto registrado",
  "finance.expense_reversed": "Gasto estornado",
  "checklist.created": "Lista de preparação criada",
  "checklist.item_added": "Item adicionado ao checklist",
  "checklist.item_completed": "Item do checklist concluído",
  "checklist.item_reopened": "Item do checklist reaberto",
  "checklist.item_removed": "Item removido do checklist",
  "document.created": "Documento registrado",
  "document.archived": "Documento arquivado",
  "document.file_attached": "Arquivo privado anexado",
  "photo.attached": "Foto adicionada ao álbum",
  "photo.archived": "Foto arquivada",
  "photo.metadata_updated": "Informações da foto atualizadas",
  "photo.restored": "Foto restaurada",
  "document.updated": "Documento atualizado",
  "document.restored": "Documento restaurado",
  "place.restored": "Local restaurado",
};

function eventPresentation(action: string) {
  if (action.startsWith("itinerary.")) return { group: "Roteiro", icon: Route, tone: "route" };
  if (action.startsWith("finance.")) return { group: "Financeiro", icon: CircleDollarSign, tone: "finance" };
  if (action.startsWith("checklist.")) return { group: "Checklist", icon: CheckCircle2, tone: "checklist" };
  if (action.startsWith("document.")) return { group: "Documentos", icon: FileText, tone: "document" };
  if (action.startsWith("photo.")) return { group: "Fotos", icon: Camera, tone: "photo" };
  if (action.includes("participant")) return { group: "Participantes", icon: Users, tone: "people" };
  return { group: "Viagem", icon: Plane, tone: "trip" };
}

export default async function ActivityPage({ params, searchParams }: ActivityPageProps) {
  const { tripId } = await params;
  const filters = await searchParams; const q = (filters.q ?? "").trim().slice(0, 80).toLocaleLowerCase("pt-BR");
  const allowedModules = ["Viagem", "Roteiro", "Financeiro", "Checklist", "Documentos", "Fotos", "Participantes"];
  const moduleFilter = allowedModules.includes(filters.module ?? "") ? filters.module! : "";
  const pageSize = 25; const requestedPage = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const [{ data: trip }, { data: auditLogs, error }] = await Promise.all([
    supabase.from("trips").select("id, name, destination").eq("id", tripId).eq("workspace_id", member.workspaceId).neq("status", "archived").maybeSingle(),
    supabase.from("audit_logs").select("id, actor_id, action, resource_type, resource_id, metadata, occurred_at").eq("workspace_id", member.workspaceId).order("occurred_at", { ascending: false }).order("id", { ascending: false }).limit(500),
  ]);
  if (!trip) notFound();

  const tripEvents = (auditLogs ?? []).filter((event) => {
    const metadata = event.metadata as AuditMetadata;
    return event.resource_id === trip.id || metadata.trip_id === trip.id;
  }).slice(0, 500);
  const filteredEvents = tripEvents.filter((event) => { const presentation = eventPresentation(event.action); const label = actionLabels[event.action] ?? "Alteração registrada"; return (!moduleFilter || presentation.group === moduleFilter) && (!q || `${label} ${presentation.group}`.toLocaleLowerCase("pt-BR").includes(q)); });
  const total = filteredEvents.length; const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize))); const pageEvents = filteredEvents.slice((page - 1) * pageSize, page * pageSize);
  const actorIds = [...new Set(pageEvents.flatMap((event) => event.actor_id ? [event.actor_id] : []))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", actorIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const actorNames = new Map((actors ?? []).map((actor) => [actor.id, actor.display_name]));
  const moduleCount = new Set(tripEvents.map((event) => eventPresentation(event.action).group)).size;
  const latestAt = tripEvents[0]?.occurred_at;
  const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" });

  return <main className="app-page activity-page">
    <div className="page-heading compact"><Link href={`/trips/${trip.id}`} className="back-link"><ArrowLeft aria-hidden="true" size={18} /> {trip.name}</Link><p className="page-eyebrow">Rastreabilidade privada</p><h1>Histórico da viagem</h1><p>Ações administrativas de {trip.destination}, da mais recente para a mais antiga.</p></div>
    {error && <p className="app-form-message" role="alert">Não foi possível carregar o histórico.</p>}

    <section className="activity-summary" aria-label="Resumo do histórico"><article><Activity aria-hidden="true" /><div><strong>{tripEvents.length}</strong><span>eventos recentes</span></div></article><article><History aria-hidden="true" /><div><strong>{moduleCount}</strong><span>áreas com atividade</span></div></article><article><UserRound aria-hidden="true" /><div><strong>{latestAt ? dateTime.format(new Date(latestAt)) : "—"}</strong><span>última alteração</span></div></article></section>
    <form className="list-filters" method="get"><label><span>Buscar no histórico</span><input defaultValue={filters.q ?? ""} maxLength={80} name="q" placeholder="Ex.: documento atualizado" /></label><label><span>Área</span><select defaultValue={moduleFilter} name="module"><option value="">Todas</option>{allowedModules.map((module) => <option key={module} value={module}>{module}</option>)}</select></label><button className="app-secondary-button" type="submit">Filtrar</button>{(q || moduleFilter) && <Link href={`/trips/${trip.id}/activity`}>Limpar</Link>}</form>

    <section className="audit-timeline" aria-label="Linha do tempo de alterações">
      {pageEvents.length ? pageEvents.map((event) => {
        const presentation = eventPresentation(event.action);
        const Icon = presentation.icon;
        const actor = event.actor_id === member.userId ? member.email : event.actor_id ? actorNames.get(event.actor_id) || "Membro do workspace" : "Sistema";
        return <article className="audit-event" key={event.id}>
          <div className={`audit-icon ${presentation.tone}`}><Icon aria-hidden="true" /></div>
          <div className="audit-event-main"><div><span>{presentation.group}</span><time dateTime={event.occurred_at}>{dateTime.format(new Date(event.occurred_at))}</time></div><h2>{actionLabels[event.action] ?? "Alteração registrada"}</h2><p>Por {actor}</p></div>
        </article>;
      }) : <div className="empty-state"><History aria-hidden="true" /><h2>{q || moduleFilter ? "Nenhum evento encontrado" : "Nenhuma alteração registrada"}</h2><p>{q || moduleFilter ? "Altere ou limpe os filtros para consultar outros eventos." : "As próximas ações relevantes aparecerão aqui automaticamente."}</p></div>}
    </section>
    <ListPagination page={page} total={total} pageSize={pageSize} pathname={`/trips/${trip.id}/activity`} params={{ q: filters.q, module: moduleFilter }} />
  </main>;
}
