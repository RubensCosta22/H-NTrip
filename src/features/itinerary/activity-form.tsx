"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { initialAccessState } from "@/src/features/access/actions";
import { addItineraryActivityAction } from "./actions";

export function ItineraryActivityForm({ tripId, dayId }: { tripId: string; dayId: string }) {
  const [state, action, pending] = useActionState(addItineraryActivityAction, initialAccessState);
  return (
    <form action={action} className="activity-form">
      <input name="tripId" type="hidden" value={tripId} />
      <input name="dayId" type="hidden" value={dayId} />
      <div className="activity-form-grid">
        <label className="app-field activity-title"><span>Atividade</span><input name="title" required maxLength={160} placeholder="Ex.: Check-in no hotel" /></label>
        <label className="app-field"><span>Início <small>(opcional)</small></span><input name="startTime" type="time" /></label>
        <label className="app-field"><span>Fim <small>(opcional)</small></span><input name="endTime" type="time" /></label>
        <label className="app-field activity-location"><span>Local <small>(opcional)</small></span><input name="location" maxLength={180} placeholder="Nome do local" /></label>
        <label className="app-field coordinate-field"><span>Latitude <small>(opcional)</small></span><input name="latitude" type="number" min="-90" max="90" step="0.000001" placeholder="-23.550520" /></label>
        <label className="app-field coordinate-field"><span>Longitude <small>(opcional)</small></span><input name="longitude" type="number" min="-180" max="180" step="0.000001" placeholder="-46.633308" /></label>
        <label className="app-field activity-description"><span>Descrição <small>(opcional)</small></span><input name="description" maxLength={2000} placeholder="Reservas, referências e detalhes" /></label>
        <label className="next-day-check"><input name="endsNextDay" type="checkbox" /><span>Termina no dia seguinte</span></label>
      </div>
      {state.message && <p className="app-form-message" role="alert">{state.message}</p>}
      <button className="secondary-action" disabled={pending} type="submit"><Plus aria-hidden="true" size={18} /> {pending ? "Adicionando…" : "Adicionar atividade"}</button>
    </form>
  );
}
