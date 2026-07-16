"use client";

import { useActionState } from "react";
import { MapPinPlus } from "lucide-react";
import { initialAccessState } from "@/src/features/access/actions";
import { addTripPlaceAction } from "./actions";

export function PlaceForm({ tripId }: { tripId: string }) {
  const [state, action, pending] = useActionState(addTripPlaceAction, initialAccessState);
  return <form action={action} className="place-form">
    <input name="tripId" type="hidden" value={tripId} />
    <div className="place-form-grid">
      <label className="app-field place-name-field"><span>Nome</span><input name="name" required maxLength={140} placeholder="Ex.: Hotel Central ou Café do Porto" /></label>
      <label className="app-field"><span>Categoria</span><select name="category" defaultValue="restaurant"><option value="lodging">Hospedagem</option><option value="restaurant">Restaurante</option><option value="cafe">Cafeteria</option><option value="attraction">Passeio</option><option value="event">Evento</option><option value="parking">Estacionamento</option><option value="other">Outro</option></select></label>
      <label className="app-field place-address-field"><span>Endereço <small>(opcional)</small></span><input name="address" maxLength={300} placeholder="Rua, número e cidade" /></label>
      <label className="app-field"><span>Telefone <small>(opcional)</small></span><input name="phone" maxLength={40} inputMode="tel" /></label>
      <label className="app-field"><span>Site <small>(opcional)</small></span><input name="website" type="url" maxLength={500} placeholder="https://" /></label>
      <label className="app-field"><span>Reserva <small>(opcional)</small></span><input name="reservationCode" maxLength={100} autoComplete="off" placeholder="Código ou referência" /></label>
      <label className="app-field"><span>Data inicial <small>(opcional)</small></span><input name="startsOn" type="date" /></label>
      <label className="app-field"><span>Data final <small>(opcional)</small></span><input name="endsOn" type="date" /></label>
      <label className="app-field"><span>Previsto <small>(opcional)</small></span><input name="plannedCost" type="number" min="0" step="0.01" inputMode="decimal" /></label>
      <label className="app-field"><span>Realizado <small>(opcional)</small></span><input name="actualCost" type="number" min="0" step="0.01" inputMode="decimal" /></label>
      <label className="app-field"><span>Avaliação <small>(opcional)</small></span><select name="rating" defaultValue=""><option value="">Sem avaliação</option><option value="5">5 — Excelente</option><option value="4">4 — Muito bom</option><option value="3">3 — Bom</option><option value="2">2 — Regular</option><option value="1">1 — Ruim</option></select></label>
      <label className="app-field place-notes-field"><span>Observações <small>(opcional)</small></span><textarea name="notes" rows={3} maxLength={1000} placeholder="Horários, preferências e informações úteis" /></label>
    </div>
    {state.message && <p className="app-form-message" role="alert">{state.message}</p>}
    <button className="app-primary-button" disabled={pending} type="submit"><MapPinPlus aria-hidden="true" size={18} /> {pending ? "Salvando…" : "Adicionar local"}</button>
  </form>;
}
