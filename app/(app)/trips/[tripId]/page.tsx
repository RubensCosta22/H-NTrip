import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowLeft, CalendarDays, Download, Mail, MapPin, Route, Trash2, Users } from "lucide-react";
import { TripForm } from "@/src/features/trips/trip-form";
import { ParticipantForm } from "@/src/features/trips/participant-form";
import { archiveTripAction, removeParticipantAction } from "@/src/features/trips/actions";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type TripDetailProps = {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ updated?: string; participant?: string; error?: string }>;
};

export default async function TripDetailPage({ params, searchParams }: TripDetailProps) {
  const { tripId } = await params;
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const [{ data: trip }, { data: participants, error: participantsError }, notices] = await Promise.all([
    supabase.from("trips").select("id, name, destination, description, start_date, end_date, timezone, base_currency, budget, status").eq("id", tripId).eq("workspace_id", member.workspaceId).neq("status", "archived").maybeSingle(),
    supabase.from("trip_participants").select("id, name, email, notes").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).order("created_at", { ascending: true }).order("id", { ascending: true }),
    searchParams,
  ]);
  if (!trip) notFound();

  const successMessage = notices.updated === "1"
    ? "Alterações salvas com sucesso."
    : notices.participant === "added"
      ? "Participante adicionado."
      : notices.participant === "removed"
        ? "Participante removido."
        : undefined;
  const errorMessage = notices.error === "archive_failed"
    ? "Não foi possível arquivar a viagem."
    : notices.error === "participant_remove_failed"
      ? "Não foi possível remover o participante."
      : participantsError
        ? "Não foi possível carregar os participantes."
        : undefined;

  return (
    <main className="app-page">
      <div className="page-heading-row trip-detail-heading">
        <div className="page-heading compact">
          <Link href="/trips" className="back-link"><ArrowLeft aria-hidden="true" size={18} /> Viagens</Link>
          <p className="page-eyebrow">Detalhes da viagem</p>
          <h1>{trip.name}</h1>
          <p><MapPin aria-hidden="true" size={18} /> {trip.destination}</p>
        </div>
        <div className="trip-heading-actions">
          <Link className="app-primary-link" href={`/trips/${trip.id}/itinerary`}><Route aria-hidden="true" size={18} /> Abrir cronograma</Link>
          <a className="app-secondary-link" href={`/api/trips/${trip.id}/export`}><Download aria-hidden="true" size={18} /> Exportar</a>
          <form action={archiveTripAction}>
            <input name="tripId" type="hidden" value={trip.id} />
            <button className="danger-outline" type="submit"><Archive aria-hidden="true" size={18} /> Arquivar viagem</button>
          </form>
        </div>
      </div>
      {successMessage && <p className="success-banner" role="status">{successMessage}</p>}
      {errorMessage && <p className="app-form-message" role="alert">{errorMessage}</p>}

      <div className="trip-detail-grid">
        <section>
          <div className="section-heading"><div><p className="page-eyebrow">Planejamento</p><h2>Informações essenciais</h2></div><CalendarDays aria-hidden="true" /></div>
          <div className="form-surface detail-form"><TripForm tripId={trip.id} defaults={{ name: trip.name, destination: trip.destination, description: trip.description ?? "", startDate: trip.start_date, endDate: trip.end_date, timezone: trip.timezone, baseCurrency: trip.base_currency, budget: String(trip.budget).replace(".", ","), status: trip.status === "planned" ? "planned" : "draft" }} /></div>
        </section>

        <section className="participants-section">
          <div className="section-heading"><div><p className="page-eyebrow">Viajantes</p><h2>Participantes</h2></div><Users aria-hidden="true" /></div>
          <p className="section-copy">Participantes são informativos e não recebem acesso ao sistema.</p>
          <ParticipantForm tripId={trip.id} />
          <div className="participant-list">
            {participants?.length ? participants.map((participant) => (
              <article className="participant-card" key={participant.id}>
                <div className="participant-avatar" aria-hidden="true">{participant.name.slice(0, 1).toUpperCase()}</div>
                <div><strong>{participant.name}</strong>{participant.email && <p><Mail aria-hidden="true" size={15} /> {participant.email}</p>}{participant.notes && <small>{participant.notes}</small>}</div>
                <form action={removeParticipantAction}>
                  <input name="participantId" type="hidden" value={participant.id} />
                  <input name="tripId" type="hidden" value={trip.id} />
                  <button aria-label={`Remover ${participant.name}`} title={`Remover ${participant.name}`} type="submit"><Trash2 aria-hidden="true" size={17} /></button>
                </form>
              </article>
            )) : <div className="participants-empty"><Users aria-hidden="true" /><p>Nenhum participante adicionado.</p></div>}
          </div>
        </section>
      </div>
    </main>
  );
}
