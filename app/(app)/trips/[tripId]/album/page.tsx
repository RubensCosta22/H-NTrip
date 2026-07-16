/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, CalendarDays, Camera, CircleDollarSign, MapPin, MapPinned, Route, Sparkles, Users } from "lucide-react";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
type AlbumPageProps = { params: Promise<{ tripId: string }> };
const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const categoryLabels: Record<string, string> = { lodging: "Hospedagem", restaurant: "Restaurante", cafe: "Cafeteria", attraction: "Passeio", event: "Evento", parking: "Estacionamento", other: "Outro" };

export default async function AlbumPage({ params }: AlbumPageProps) {
  const { tripId } = await params;
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const [
    { data: trip }, { data: participants }, { data: days }, { data: activities },
    { data: places }, { data: expenses }, { data: photos },
  ] = await Promise.all([
    supabase.from("trips").select("id, name, destination, description, start_date, end_date, base_currency, budget, status").eq("id", tripId).eq("workspace_id", member.workspaceId).neq("status", "archived").maybeSingle(),
    supabase.from("trip_participants").select("id, name").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).order("created_at", { ascending: true }),
    supabase.from("itinerary_days").select("id, day_date, title, notes").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).order("day_date", { ascending: true }).order("id", { ascending: true }),
    supabase.from("itinerary_activities").select("id, itinerary_day_id, title, location_name, start_time, position").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).order("position", { ascending: true }).order("id", { ascending: true }),
    supabase.from("trip_places").select("id, name, category, rating").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("archived_at", null).order("name", { ascending: true }),
    supabase.from("expenses").select("amount").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("deleted_at", null),
    supabase.from("trip_photos").select("id, caption, taken_on, created_at, is_favorite, is_cover, location_name").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("archived_at", null).order("is_cover", { ascending: false }).order("is_favorite", { ascending: false }).order("taken_on", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }).order("id", { ascending: true }),
  ]);
  if (!trip) notFound();

  const duration = Math.round((new Date(`${trip.end_date}T00:00:00Z`).getTime() - new Date(`${trip.start_date}T00:00:00Z`).getTime()) / 86400000) + 1;
  const spent = (expenses ?? []).reduce((sum, expense) => sum + Number(expense.amount), 0);
  const formatMoney = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: trip.base_currency }).format(value);
  const activitiesByDay = new Map<string, NonNullable<typeof activities>>();
  for (const activity of activities ?? []) { const group = activitiesByDay.get(activity.itinerary_day_id) ?? []; group.push(activity); activitiesByDay.set(activity.itinerary_day_id, group); }
  const cover = photos?.find((photo) => photo.is_cover) ?? photos?.[0];
  const highlights = (places ?? []).filter((place) => place.rating && place.rating >= 4).slice(0, 6);

  return <main className="album-page">
    <section className={`album-cover ${cover ? "has-cover" : ""}`} style={cover ? { backgroundImage: `linear-gradient(180deg, rgba(4,15,27,.18), rgba(4,15,27,.94)), url(/api/photos/${cover.id})` } : undefined}>
      <Link href={`/trips/${trip.id}`} className="album-back"><ArrowLeft aria-hidden="true" size={18} /> Voltar para a viagem</Link>
      <div className="album-cover-copy"><p><Sparkles aria-hidden="true" size={16} /> Nossa viagem</p><h1>{trip.name}</h1><span><MapPin aria-hidden="true" size={17} /> {trip.destination}</span><strong>{formatDate(trip.start_date)} — {formatDate(trip.end_date)}</strong></div>
      <div className="album-cover-stats"><span><CalendarDays aria-hidden="true" /><strong>{duration}</strong> dias</span><span><Camera aria-hidden="true" /><strong>{photos?.length ?? 0}</strong> fotos</span><span><Route aria-hidden="true" /><strong>{activities?.length ?? 0}</strong> momentos</span></div>
    </section>

    <div className="album-content">
      {trip.status !== "completed" && <div className="album-building"><BookOpen aria-hidden="true" /><p><strong>Álbum em construção</strong><span>Ele é atualizado automaticamente conforme a viagem ganha fotos, locais e atividades.</span></p></div>}
      <section className="album-intro"><div><p className="page-eyebrow">A história</p><h2>{trip.description || `Memórias de ${trip.destination}`}</h2></div><div className="album-people"><Users aria-hidden="true" /><span>{participants?.length ? participants.map((person) => person.name).join(" · ") : "Participantes ainda não informados"}</span></div></section>

      <section className="album-metrics" aria-label="Resumo da viagem"><article><CircleDollarSign aria-hidden="true" /><span>Investimento</span><strong>{formatMoney(spent)}</strong></article><article><MapPinned aria-hidden="true" /><span>Locais salvos</span><strong>{places?.length ?? 0}</strong></article><article><Route aria-hidden="true" /><span>Dias planejados</span><strong>{days?.length ?? 0}</strong></article><article><Camera aria-hidden="true" /><span>Memórias</span><strong>{photos?.length ?? 0}</strong></article></section>

      <section className="album-section"><div className="album-section-heading"><p className="page-eyebrow">Diário</p><h2>A viagem, dia a dia</h2></div><div className="album-timeline">{days?.length ? days.map((day, index) => <article key={day.id}><div className="album-day-marker"><span>{index + 1}</span></div><div><time>{formatDate(day.day_date)}</time><h3>{day.title || `Dia ${index + 1}`}</h3>{day.notes && <p>{day.notes}</p>}<ul>{(activitiesByDay.get(day.id) ?? []).map((activity) => <li key={activity.id}><span>{activity.start_time?.slice(0, 5) || "—"}</span><strong>{activity.title}</strong>{activity.location_name && <small>{activity.location_name}</small>}</li>)}</ul></div></article>) : <div className="album-empty"><Route aria-hidden="true" /><p>O diário aparecerá quando o roteiro tiver dias e atividades.</p></div>}</div></section>

      <section className="album-section"><div className="album-section-heading"><p className="page-eyebrow">Galeria</p><h2>Momentos favoritos</h2></div>{photos?.length ? <div className="album-photo-grid">{photos.slice(0, 9).map((photo, index) => <a className={index === 0 ? "featured" : ""} href={`/api/photos/${photo.id}`} target="_blank" rel="noreferrer" key={photo.id}><img src={`/api/photos/${photo.id}`} alt={photo.caption || `Memória de ${trip.destination}`} loading="lazy" /><span>{photo.caption || (photo.taken_on ? formatDate(photo.taken_on) : "Nossa viagem")}{photo.location_name ? ` · ${photo.location_name}` : ""}</span></a>)}</div> : <div className="album-empty"><Camera aria-hidden="true" /><p>Adicione fotos privadas para compor esta galeria automaticamente.</p><Link href={`/trips/${trip.id}/photos`}>Adicionar fotos</Link></div>}</section>

      <section className="album-section album-highlights"><div className="album-section-heading"><p className="page-eyebrow">Destaques</p><h2>Locais que marcaram</h2></div>{highlights.length ? <div>{highlights.map((place) => <article key={place.id}><span>{categoryLabels[place.category] ?? "Local"}</span><h3>{place.name}</h3><strong>{"★".repeat(place.rating ?? 0)}</strong></article>)}</div> : <div className="album-empty"><MapPinned aria-hidden="true" /><p>Avalie os locais visitados para criar seus destaques.</p><Link href={`/trips/${trip.id}/places`}>Avaliar locais</Link></div>}</section>
    </div>
  </main>;
}
