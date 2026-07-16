"use client";

import { useActionState } from "react";
import { CalendarDays, MapPin, WalletCards } from "lucide-react";
import { initialAccessState } from "@/src/features/access/actions";
import { createTripAction, updateTripAction } from "./actions";

type TripDefaults = {
  name: string;
  destination: string;
  description: string;
  startDate: string;
  endDate: string;
  timezone: string;
  baseCurrency: string;
  budget: string;
  status: "draft" | "planned";
};

export function TripForm({ tripId, defaults }: { tripId?: string; defaults?: TripDefaults }) {
  const editing = Boolean(tripId && defaults);
  const [state, action, pending] = useActionState(
    editing ? updateTripAction : createTripAction,
    initialAccessState,
  );

  return (
    <form action={action} className="trip-form">
      {tripId && <input name="tripId" type="hidden" value={tripId} />}
      <div className="form-grid">
        <label className="app-field app-field-wide">
          <span>Nome da viagem</span>
          <input name="name" required maxLength={120} placeholder="Ex.: Serra Gaúcha 2027" defaultValue={defaults?.name} />
        </label>
        <label className="app-field app-field-wide">
          <span>Destino</span>
          <span className="app-input-icon"><MapPin aria-hidden="true" size={18} /><input name="destination" required maxLength={160} placeholder="Gramado, Rio Grande do Sul" defaultValue={defaults?.destination} /></span>
        </label>
        <label className="app-field">
          <span>Data inicial</span>
          <span className="app-input-icon"><CalendarDays aria-hidden="true" size={18} /><input name="startDate" required type="date" defaultValue={defaults?.startDate} /></span>
        </label>
        <label className="app-field">
          <span>Data final</span>
          <span className="app-input-icon"><CalendarDays aria-hidden="true" size={18} /><input name="endDate" required type="date" defaultValue={defaults?.endDate} /></span>
        </label>
        <label className="app-field">
          <span>Fuso horário</span>
          <select name="timezone" defaultValue={defaults?.timezone ?? "America/Sao_Paulo"} required>
            <option value="America/Sao_Paulo">Brasília — São Paulo</option>
            <option value="America/New_York">Nova York</option>
            <option value="Europe/London">Londres</option>
            <option value="Europe/Paris">Paris</option>
            <option value="Asia/Tokyo">Tóquio</option>
          </select>
        </label>
        <div className="money-fields">
          <label className="app-field currency-field">
            <span>Moeda</span>
            <select name="baseCurrency" defaultValue={defaults?.baseCurrency ?? "BRL"} required>
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="JPY">JPY</option>
            </select>
          </label>
          <label className="app-field budget-field">
            <span>Orçamento</span>
            <span className="app-input-icon"><WalletCards aria-hidden="true" size={18} /><input inputMode="decimal" name="budget" required pattern="[0-9]+([,.][0-9]{1,2})?" defaultValue={defaults?.budget ?? "0,00"} /></span>
          </label>
        </div>
        {editing && (
          <label className="app-field app-field-wide">
            <span>Status do planejamento</span>
            <select name="status" defaultValue={defaults?.status ?? "draft"} required>
              <option value="draft">Rascunho</option>
              <option value="planned">Planejada</option>
            </select>
          </label>
        )}
        <label className="app-field app-field-wide">
          <span>Descrição <small>(opcional)</small></span>
          <textarea name="description" maxLength={2000} rows={4} placeholder="O que torna esta viagem especial?" defaultValue={defaults?.description} />
        </label>
      </div>
      {state.message && <p className="app-form-message" role="alert">{state.message}</p>}
      <div className="form-actions">
        <a href={tripId ? `/trips/${tripId}` : "/trips"}>Cancelar</a>
        <button type="submit" disabled={pending}>{pending ? "Salvando…" : editing ? "Salvar alterações" : "Criar viagem"}</button>
      </div>
    </form>
  );
}
