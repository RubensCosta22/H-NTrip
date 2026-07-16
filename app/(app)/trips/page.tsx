import Link from "next/link";
import { Archive, CalendarDays, MapPin, Plus, Route } from "lucide-react";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type TripsPageProps = { searchParams: Promise<{ created?: string; archived?: string }> };

export default async function TripsPage({ searchParams }: TripsPageProps) {
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { data: trips, error } = await supabase
    .from("trips")
    .select("id, name, destination, start_date, end_date, status, base_currency, budget")
    .eq("workspace_id", member.workspaceId)
    .neq("status", "archived")
    .order("start_date", { ascending: true })
    .order("id", { ascending: true })
    .limit(50);
  const params = await searchParams;

  return (
    <main className="app-page">
      <div className="page-heading-row">
        <div className="page-heading">
          <p className="page-eyebrow">Planejamento</p>
          <h1>Suas viagens</h1>
          <p>Organize cada destino do primeiro plano à última lembrança.</p>
        </div>
        <div className="page-heading-actions"><Link className="app-secondary-link" href="/trips/archived"><Archive aria-hidden="true" size={18} /> Arquivadas</Link><Link className="app-primary-link" href="/trips/new"><Plus aria-hidden="true" size={18} /> Nova viagem</Link></div>
      </div>
      {params.created === "1" && <p className="success-banner" role="status">Viagem criada com sucesso.</p>}
      {params.archived === "1" && <p className="success-banner" role="status">Viagem arquivada com sucesso.</p>}
      {error ? (
        <section className="empty-state"><Route aria-hidden="true" /><h2>Não foi possível carregar as viagens</h2><p>Tente novamente em alguns instantes.</p></section>
      ) : trips?.length ? (
        <section className="trip-grid" aria-label="Lista de viagens">
          {trips.map((trip) => (
            <article className="trip-card" key={trip.id}>
              <div className="trip-status">{trip.status === "draft" ? "Rascunho" : trip.status === "planned" ? "Planejada" : trip.status === "ongoing" ? "Em andamento" : "Concluída"}</div>
              <h2>{trip.name}</h2>
              <p><MapPin aria-hidden="true" size={17} /> {trip.destination}</p>
              <p><CalendarDays aria-hidden="true" size={17} /> {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${trip.start_date}T00:00:00Z`))} — {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${trip.end_date}T00:00:00Z`))}</p>
              <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: trip.base_currency }).format(Number(trip.budget))}</strong>
              <Link className="trip-card-link" href={`/trips/${trip.id}`}>Abrir planejamento</Link>
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-state"><Route aria-hidden="true" /><h2>Sua próxima história começa aqui</h2><p>Crie a primeira viagem para reunir datas, orçamento e planejamento.</p><Link className="app-primary-link" href="/trips/new"><Plus aria-hidden="true" size={18} /> Criar primeira viagem</Link></section>
      )}
    </main>
  );
}
