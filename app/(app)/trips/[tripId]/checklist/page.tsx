import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, CalendarDays, Check, CheckCircle2, Circle, ClipboardCheck, Trash2, UserRound } from "lucide-react";
import { ChecklistForm } from "@/src/features/checklist/checklist-form";
import { ChecklistItemForm } from "@/src/features/checklist/item-form";
import { moveChecklistItemAction, removeChecklistItemAction, setChecklistItemCompletionAction } from "@/src/features/checklist/actions";
import { TripRealtimeRefresh } from "@/src/components/trip-realtime-refresh";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { getSupabasePublicConfig } from "@/src/lib/supabase/config";

export const dynamic = "force-dynamic";

type ChecklistPageProps = { params: Promise<{ tripId: string }>; searchParams: Promise<{ list?: string; item?: string; error?: string }> };

export default async function ChecklistPage({ params, searchParams }: ChecklistPageProps) {
  const { tripId } = await params;
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const supabaseConfig = getSupabasePublicConfig();
  const [{ data: trip }, { data: lists }, { data: items }, notices] = await Promise.all([
    supabase.from("trips").select("id, name").eq("id", tripId).eq("workspace_id", member.workspaceId).neq("status", "archived").maybeSingle(),
    supabase.from("checklists").select("id, name, description").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("archived_at", null).order("created_at", { ascending: true }).order("id", { ascending: true }),
    supabase.from("checklist_items").select("id, checklist_id, title, notes, assignee_name, due_date, position, is_completed, completed_at").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).order("position", { ascending: true }).order("id", { ascending: true }),
    searchParams,
  ]);
  if (!trip) notFound();
  const itemsByList = new Map<string, NonNullable<typeof items>>();
  for (const item of items ?? []) { const group = itemsByList.get(item.checklist_id) ?? []; group.push(item); itemsByList.set(item.checklist_id, group); }
  const totalItems = items?.length ?? 0;
  const completedItems = items?.filter((item) => item.is_completed).length ?? 0;
  const percent = totalItems ? (completedItems / totalItems) * 100 : 0;
  const successMessage = notices.list === "added" ? "Lista criada." : notices.item === "added" ? "Item adicionado." : notices.item === "removed" ? "Item removido." : undefined;

  return <main className="app-page checklist-page">
    <TripRealtimeRefresh tripId={trip.id} tables={["checklists", "checklist_items"]} supabaseConfig={supabaseConfig} />
    <div className="page-heading compact"><Link href={`/trips/${trip.id}`} className="back-link"><ArrowLeft aria-hidden="true" size={18} /> {trip.name}</Link><p className="page-eyebrow">Preparação</p><h1>Checklist da viagem</h1><p>Organize pendências sem conceder acesso aos responsáveis informados.</p></div>
    {successMessage && <p className="success-banner" role="status">{successMessage}</p>}{notices.error && <p className="app-form-message" role="alert">Não foi possível concluir a operação.</p>}
    <section className="checklist-overview"><article><CheckCircle2 aria-hidden="true" /><div><strong>{completedItems} de {totalItems}</strong><span>itens concluídos</span></div></article><div className="checklist-progress" aria-label={`${percent.toFixed(0)}% concluído`}><span style={{ width: `${percent}%` }} /></div></section>
    <section className="new-checklist-panel"><div><p className="page-eyebrow">Nova organização</p><h2>Criar lista</h2></div><ChecklistForm tripId={trip.id} /></section>
    <section className="checklist-boards">
      {lists?.length ? lists.map((list) => { const listItems = itemsByList.get(list.id) ?? []; const listCompleted = listItems.filter((item) => item.is_completed).length; return <article className="checklist-board" key={list.id}>
        <header><div><p>{listCompleted}/{listItems.length} concluídos</p><h2>{list.name}</h2>{list.description && <small>{list.description}</small>}</div><ClipboardCheck aria-hidden="true" /></header>
        <div className="checklist-items">{listItems.length ? listItems.map((item, index) => <div className={`checklist-item ${item.is_completed ? "completed" : ""}`} key={item.id}>
          <form action={setChecklistItemCompletionAction}><input name="tripId" type="hidden" value={trip.id} /><input name="itemId" type="hidden" value={item.id} /><input name="completed" type="hidden" value={item.is_completed ? "false" : "true"} /><button className="completion-toggle" aria-label={item.is_completed ? `Reabrir ${item.title}` : `Concluir ${item.title}`} type="submit">{item.is_completed ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}</button></form>
          <div className="checklist-item-main"><strong>{item.title}</strong><div>{item.assignee_name && <span><UserRound aria-hidden="true" size={14} /> {item.assignee_name}</span>}{item.due_date && <span><CalendarDays aria-hidden="true" size={14} /> {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${item.due_date}T00:00:00Z`))}</span>}</div>{item.notes && <small>{item.notes}</small>}</div>
          <div className="checklist-item-actions"><form action={moveChecklistItemAction}><input name="tripId" type="hidden" value={trip.id} /><input name="itemId" type="hidden" value={item.id} /><input name="direction" type="hidden" value="up" /><button disabled={index === 0} aria-label={`Mover ${item.title} para cima`}><ArrowUp aria-hidden="true" /></button></form><form action={moveChecklistItemAction}><input name="tripId" type="hidden" value={trip.id} /><input name="itemId" type="hidden" value={item.id} /><input name="direction" type="hidden" value="down" /><button disabled={index === listItems.length - 1} aria-label={`Mover ${item.title} para baixo`}><ArrowDown aria-hidden="true" /></button></form><form action={removeChecklistItemAction}><input name="tripId" type="hidden" value={trip.id} /><input name="itemId" type="hidden" value={item.id} /><button className="remove-checklist-item" aria-label={`Remover ${item.title}`}><Trash2 aria-hidden="true" /></button></form></div>
        </div>) : <p className="checklist-empty">Nenhum item nesta lista.</p>}</div>
        <details className="activity-disclosure"><summary>Adicionar item</summary><div className="checklist-item-form-wrap"><ChecklistItemForm tripId={trip.id} checklistId={list.id} /></div></details>
      </article>; }) : <div className="empty-state"><ClipboardCheck aria-hidden="true" /><h2>Nenhuma lista criada</h2><p>Crie uma lista para documentos, bagagem, reservas ou qualquer preparação.</p></div>}
    </section>
  </main>;
}
