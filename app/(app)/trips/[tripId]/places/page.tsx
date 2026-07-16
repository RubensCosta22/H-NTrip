import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowLeft, BedDouble, CalendarDays, ExternalLink, MapPinned, Phone, Star } from "lucide-react";
import { archiveTripPlaceAction } from "@/src/features/places/actions";
import { PlaceForm } from "@/src/features/places/place-form";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type PlacesPageProps = {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ place?: string; error?: string; category?: string }>;
};

const categoryLabels: Record<string, string> = {
  lodging: "Hospedagem", restaurant: "Restaurante", cafe: "Cafeteria",
  attraction: "Passeio", event: "Evento", parking: "Estacionamento", other: "Outro",
};
const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const formatMoney = (value: number | string | null, currency: string) => value === null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(value));

export default async function PlacesPage({ params, searchParams }: PlacesPageProps) {
  const { tripId } = await params;
  const notices = await searchParams;
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const [{ data: trip }, { data: places, error }] = await Promise.all([
    supabase.from("trips").select("id, name, base_currency").eq("id", tripId).eq("workspace_id", member.workspaceId).neq("status", "archived").maybeSingle(),
    supabase.from("trip_places").select("id, name, category, address, phone, website, reservation_code, starts_on, ends_on, planned_cost, actual_cost, rating, notes").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("archived_at", null).order("starts_on", { ascending: true, nullsFirst: false }).order("name", { ascending: true }).order("id", { ascending: true }),
  ]);
  if (!trip) notFound();

  const selectedCategory = notices.category && categoryLabels[notices.category] ? notices.category : "all";
  const visiblePlaces = selectedCategory === "all" ? (places ?? []) : (places ?? []).filter((place) => place.category === selectedCategory);
  const lodgingCount = places?.filter((place) => place.category === "lodging").length ?? 0;
  const foodCount = places?.filter((place) => place.category === "restaurant" || place.category === "cafe").length ?? 0;
  const successMessage = notices.place === "added" ? "Local adicionado." : notices.place === "archived" ? "Local arquivado." : undefined;

  return <main className="app-page places-page">
    <div className="page-heading compact"><Link href={`/trips/${trip.id}`} className="back-link"><ArrowLeft aria-hidden="true" size={18} /> {trip.name}</Link><p className="page-eyebrow">Guia da viagem</p><h1>Locais e reservas</h1><p>Organize hospedagens, restaurantes, passeios e pontos úteis em um só lugar.</p></div>
    {successMessage && <p className="success-banner" role="status">{successMessage}</p>}
    {(notices.error || error) && <p className="app-form-message" role="alert">Não foi possível concluir a operação.</p>}

    <section className="place-summary" aria-label="Resumo dos locais">
      <article><MapPinned aria-hidden="true" /><div><strong>{places?.length ?? 0}</strong><span>locais salvos</span></div></article>
      <article><BedDouble aria-hidden="true" /><div><strong>{lodgingCount}</strong><span>hospedagens</span></div></article>
      <article><Star aria-hidden="true" /><div><strong>{foodCount}</strong><span>restaurantes e cafés</span></div></article>
    </section>

    <section className="new-place-panel">
      <div className="section-heading"><div><p className="page-eyebrow">Novo ponto</p><h2>Adicionar ao guia</h2></div><MapPinned aria-hidden="true" /></div>
      <p className="section-copy">Os dados são privados e isolados por workspace. Evite registrar senhas ou dados completos de pagamento.</p>
      <PlaceForm tripId={trip.id} />
    </section>

    <nav className="place-filters" aria-label="Filtrar locais">
      <Link className={selectedCategory === "all" ? "active" : ""} href={`/trips/${trip.id}/places`}>Todos</Link>
      {Object.entries(categoryLabels).map(([value, label]) => <Link className={selectedCategory === value ? "active" : ""} href={`/trips/${trip.id}/places?category=${value}`} key={value}>{label}</Link>)}
    </nav>

    <section className="place-grid" aria-label="Locais salvos">
      {visiblePlaces.length ? visiblePlaces.map((place) => <article className="place-card" key={place.id}>
        <header><span>{categoryLabels[place.category] ?? "Local"}</span>{place.rating && <strong aria-label={`${place.rating} de 5 estrelas`}><Star aria-hidden="true" size={14} /> {place.rating}</strong>}</header>
        <h2>{place.name}</h2>
        {place.address && <p className="place-address"><MapPinned aria-hidden="true" size={16} /> {place.address}</p>}
        {(place.starts_on || place.ends_on) && <p><CalendarDays aria-hidden="true" size={16} /> {place.starts_on ? formatDate(place.starts_on) : "Data aberta"}{place.ends_on ? ` até ${formatDate(place.ends_on)}` : ""}</p>}
        {place.reservation_code && <div className="reservation-reference"><span>Reserva</span><strong>{place.reservation_code}</strong></div>}
        <div className="place-costs"><span>Previsto <strong>{formatMoney(place.planned_cost, trip.base_currency)}</strong></span><span>Realizado <strong>{formatMoney(place.actual_cost, trip.base_currency)}</strong></span></div>
        {place.notes && <small>{place.notes}</small>}
        <footer><div>{place.phone && <a href={`tel:${place.phone}`}><Phone aria-hidden="true" size={15} /> Ligar</a>}{place.website && <a href={place.website} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" size={15} /> Site</a>}</div><form action={archiveTripPlaceAction}><input name="tripId" type="hidden" value={trip.id} /><input name="placeId" type="hidden" value={place.id} /><button aria-label={`Arquivar ${place.name}`} type="submit"><Archive aria-hidden="true" size={16} /></button></form></footer>
      </article>) : <div className="empty-state place-empty"><MapPinned aria-hidden="true" /><h2>Nenhum local nesta categoria</h2><p>Adicione a primeira hospedagem, restaurante ou atração da viagem.</p></div>}
    </section>
  </main>;
}
