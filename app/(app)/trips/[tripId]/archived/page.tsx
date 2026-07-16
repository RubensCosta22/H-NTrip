import { notFound } from "next/navigation";
import { ArchiveRestore, Camera, FileText, MapPinned } from "lucide-react";
import { restoreTripItemAction } from "@/src/features/archive/actions";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function ArchivedTripItemsPage({ params, searchParams }: { params: Promise<{ tripId: string }>; searchParams: Promise<{ restored?: string; error?: string }> }) {
  const { tripId } = await params; const notices = await searchParams; const member = await requireCurrentMember(); const supabase = await createServerSupabaseClient();
  const [{ data: trip }, { data: documents }, { data: photos }, { data: places }] = await Promise.all([
    supabase.from("trips").select("id, name").eq("id", tripId).eq("workspace_id", member.workspaceId).neq("status", "archived").maybeSingle(),
    supabase.from("trip_documents").select("id, title, category, archived_at").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).not("archived_at", "is", null).order("archived_at", { ascending: false }),
    supabase.from("trip_photos").select("id, original_filename, caption, archived_at").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).not("archived_at", "is", null).order("archived_at", { ascending: false }),
    supabase.from("trip_places").select("id, name, category, archived_at").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).not("archived_at", "is", null).order("archived_at", { ascending: false }),
  ]);
  if (!trip) notFound();
  const groups = [
    { kind: "document", title: "Documentos", icon: FileText, items: (documents ?? []).map((item) => ({ ...item, name: item.title, detail: item.category })) },
    { kind: "photo", title: "Fotos", icon: Camera, items: (photos ?? []).map((item) => ({ ...item, name: item.caption || item.original_filename, detail: item.original_filename })) },
    { kind: "place", title: "Locais", icon: MapPinned, items: (places ?? []).map((item) => ({ ...item, detail: item.category })) },
  ] as const;
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  return <main className="app-page"><div className="page-heading compact"><p className="page-eyebrow">Recuperação</p><h1>Arquivados de {trip.name}</h1><p>Restaure registros removidos das áreas ativas. Nenhum arquivo é apagado durante o arquivamento.</p></div>
    {notices.restored === "1" && <p className="success-banner" role="status">Item restaurado.</p>}{notices.error && <p className="app-form-message" role="alert">Não foi possível restaurar o item.</p>}
    {total ? <div className="archive-groups">{groups.map((group) => group.items.length ? <section key={group.kind}><h2><group.icon aria-hidden="true" /> {group.title} <span>{group.items.length}</span></h2><div>{group.items.map((item) => <article key={item.id}><div><strong>{item.name}</strong><small>{item.detail}</small></div><form action={restoreTripItemAction}><input name="tripId" type="hidden" value={trip.id} /><input name="itemId" type="hidden" value={item.id} /><input name="kind" type="hidden" value={group.kind} /><button className="app-secondary-button" type="submit"><ArchiveRestore aria-hidden="true" size={16} /> Restaurar</button></form></article>)}</div></section> : null)}</div> : <section className="empty-state"><ArchiveRestore aria-hidden="true" /><h2>Nenhum item arquivado</h2><p>Fotos, documentos e locais arquivados aparecerão aqui.</p></section>}
  </main>;
}
