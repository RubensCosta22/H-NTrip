"use client";

import { useActionState } from "react";
import { CalendarPlus } from "lucide-react";
import { initialAccessState } from "@/src/features/access/actions";
import { addItineraryDayAction } from "./actions";

export function ItineraryDayForm({ tripId, minDate, maxDate }: { tripId: string; minDate: string; maxDate: string }) {
  const [state, action, pending] = useActionState(addItineraryDayAction, initialAccessState);
  return (
    <form action={action} className="itinerary-day-form">
      <input name="tripId" type="hidden" value={tripId} />
      <label className="app-field"><span>Data</span><input name="date" type="date" min={minDate} max={maxDate} required /></label>
      <label className="app-field"><span>Título <small>(opcional)</small></span><input name="title" maxLength={120} placeholder="Ex.: Chegada e centro histórico" /></label>
      <label className="app-field itinerary-notes"><span>Notas <small>(opcional)</small></span><input name="notes" maxLength={1000} placeholder="Contexto e lembretes para o dia" /></label>
      {state.message && <p className="app-form-message" role="alert">{state.message}</p>}
      <button className="secondary-action" disabled={pending} type="submit"><CalendarPlus aria-hidden="true" size={18} /> {pending ? "Adicionando…" : "Adicionar dia"}</button>
    </form>
  );
}
