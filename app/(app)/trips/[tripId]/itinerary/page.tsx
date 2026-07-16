import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Clock3, MapPin, Route, Trash2 } from "lucide-react";
import { ItineraryDayForm } from "@/src/features/itinerary/day-form";
import { ItineraryActivityForm } from "@/src/features/itinerary/activity-form";
import { TripMap } from "@/src/features/itinerary/trip-map";
import { moveItineraryActivityAction, removeItineraryActivityAction } from "@/src/features/itinerary/actions";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type ItineraryPageProps = {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ day?: string; activity?: string; error?: string }>;
};

export default async function ItineraryPage({ params, searchParams }: ItineraryPageProps) {
  const { tripId } = await params;
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const [{ data: trip }, { data: days }, { data: activities }, notices] = await Promise.all([
    supabase.from("trips").select("id, name, destination, start_date, end_date, timezone").eq("id", tripId).eq("workspace_id", member.workspaceId).neq("status", "archived").maybeSingle(),
    supabase.from("itinerary_days").select("id, day_date, title, notes").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).order("day_date", { ascending: true }).order("id", { ascending: true }),
    supabase.from("itinerary_activities").select("id, itinerary_day_id, title, description, location_name, location_latitude, location_longitude, start_time, end_time, ends_next_day, timezone, position").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).order("position", { ascending: true }).order("id", { ascending: true }),
    searchParams,
  ]);
  if (!trip) notFound();

  const groupedActivities = new Map<string, NonNullable<typeof activities>>();
  for (const activity of activities ?? []) {
    const current = groupedActivities.get(activity.itinerary_day_id) ?? [];
    current.push(activity);
    groupedActivities.set(activity.itinerary_day_id, current);
  }
  const successMessage = notices.day === "added" ? "Dia adicionado ao cronograma." : notices.activity === "added" ? "Atividade adicionada." : notices.activity === "removed" ? "Atividade removida." : undefined;
  const mapLocations = (activities ?? []).flatMap((activity) => activity.location_latitude !== null && activity.location_longitude !== null ? [{ id: activity.id, title: activity.title, location: activity.location_name, latitude: Number(activity.location_latitude), longitude: Number(activity.location_longitude) }] : []);

  return (
    <main className="app-page itinerary-page">
      <div className="page-heading-row">
        <div className="page-heading compact">
          <Link href={`/trips/${trip.id}`} className="back-link"><ArrowLeft aria-hidden="true" size={18} /> {trip.name}</Link>
          <p className="page-eyebrow">Cronograma</p>
          <h1>Roteiro da viagem</h1>
          <p><MapPin aria-hidden="true" size={18} /> {trip.destination} · Horários em {trip.timezone}</p>
        </div>
      </div>
      {successMessage && <p className="success-banner" role="status">{successMessage}</p>}
      {notices.error && <p className="app-form-message" role="alert">Não foi possível concluir a operação.</p>}

      <section className="itinerary-add-day">
        <div><p className="page-eyebrow">Estrutura do roteiro</p><h2>Adicionar um dia</h2><p>Use uma data entre o início e o fim da viagem.</p></div>
        <ItineraryDayForm tripId={trip.id} minDate={trip.start_date} maxDate={trip.end_date} />
      </section>

      <TripMap locations={mapLocations} />

      <section className="itinerary-timeline" aria-label="Dias e atividades do roteiro">
        {days?.length ? days.map((day, dayIndex) => {
          const dayActivities = groupedActivities.get(day.id) ?? [];
          return (
            <article className="itinerary-day" key={day.id}>
              <div className="day-marker"><span>{dayIndex + 1}</span></div>
              <div className="day-content">
                <header><div><p>{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" }).format(new Date(`${day.day_date}T00:00:00Z`))}</p><h2>{day.title || `Dia ${dayIndex + 1}`}</h2>{day.notes && <small>{day.notes}</small>}</div><Route aria-hidden="true" /></header>
                <div className="activity-list">
                  {dayActivities.length ? dayActivities.map((activity, index) => (
                    <div className="activity-card" key={activity.id}>
                      <div className="activity-time"><Clock3 aria-hidden="true" size={17} /><span>{activity.start_time?.slice(0, 5) || "Livre"}{activity.end_time && ` — ${activity.end_time.slice(0, 5)}`}{activity.ends_next_day && " (+1)"}</span></div>
                      <div className="activity-main"><strong>{activity.title}</strong>{activity.location_name && <p><MapPin aria-hidden="true" size={15} /> {activity.location_name}</p>}{activity.description && <small>{activity.description}</small>}</div>
                      <div className="activity-actions">
                        <form action={moveItineraryActivityAction}><input name="tripId" type="hidden" value={trip.id} /><input name="activityId" type="hidden" value={activity.id} /><input name="direction" type="hidden" value="up" /><button disabled={index === 0} aria-label={`Mover ${activity.title} para cima`} type="submit"><ArrowUp aria-hidden="true" size={16} /></button></form>
                        <form action={moveItineraryActivityAction}><input name="tripId" type="hidden" value={trip.id} /><input name="activityId" type="hidden" value={activity.id} /><input name="direction" type="hidden" value="down" /><button disabled={index === dayActivities.length - 1} aria-label={`Mover ${activity.title} para baixo`} type="submit"><ArrowDown aria-hidden="true" size={16} /></button></form>
                        <form action={removeItineraryActivityAction}><input name="tripId" type="hidden" value={trip.id} /><input name="activityId" type="hidden" value={activity.id} /><button className="remove-activity" aria-label={`Remover ${activity.title}`} type="submit"><Trash2 aria-hidden="true" size={16} /></button></form>
                      </div>
                    </div>
                  )) : <p className="activities-empty">Nenhuma atividade neste dia.</p>}
                </div>
                <details className="activity-disclosure"><summary>Adicionar atividade</summary><ItineraryActivityForm tripId={trip.id} dayId={day.id} /></details>
              </div>
            </article>
          );
        }) : <div className="empty-state"><Route aria-hidden="true" /><h2>O roteiro ainda está em branco</h2><p>Adicione o primeiro dia para começar a organizar horários e atividades.</p></div>}
      </section>
    </main>
  );
}
