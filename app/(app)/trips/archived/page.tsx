import Link from "next/link";
import { ArchiveRestore, CalendarDays, MapPin } from "lucide-react";
import { restoreTripAction } from "@/src/features/archive/actions";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function ArchivedTripsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const notices = await searchParams; const member = await requireCurrentMember(); const supabase = await createServerSupabaseClient();
  const { data: trips } = await supabase.from("trips").select("id, name, destination, start_date, end_date").eq("workspace_id", member.workspaceId).eq("status", "archived").order("archived_at", { ascending: false }).limit(100);
  const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  return <main className="app-page"><div className="page-heading-row"><div className="page-heading"><p className="page-eyebrow">Recuperação</p><h1>Viagens arquivadas</h1><p>Restaure uma viagem como rascunho para revisar seus dados antes de reativá-la.</p></div><Link className="app-secondary-link" href="/trips">Voltar às viagens</Link></div>
    {notices.error && <p className="app-form-message" role="alert">Não foi possível restaurar a viagem.</p>}
    {trips?.length ? <section className="archive-trip-list">{trips.map((trip) => <article key={trip.id}><div><h2>{trip.name}</h2><p><MapPin size={16} /> {trip.destination}</p><small><CalendarDays size={15} /> {formatDate(trip.start_date)} — {formatDate(trip.end_date)}</small></div><form action={restoreTripAction}><input name="tripId" type="hidden" value={trip.id} /><button className="app-primary-button" type="submit"><ArchiveRestore size={17} /> Restaurar como rascunho</button></form></article>)}</section> : <section className="empty-state"><ArchiveRestore aria-hidden="true" /><h2>Nenhuma viagem arquivada</h2><p>As viagens arquivadas aparecerão aqui.</p></section>}
  </main>;
}
