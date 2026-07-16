"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { initialAccessState } from "@/src/features/access/actions";
import { addParticipantAction } from "./actions";

export function ParticipantForm({ tripId }: { tripId: string }) {
  const [state, action, pending] = useActionState(addParticipantAction, initialAccessState);
  return (
    <form action={action} className="participant-form">
      <input name="tripId" type="hidden" value={tripId} />
      <div className="participant-form-grid">
        <label className="app-field"><span>Nome</span><input name="name" required maxLength={120} placeholder="Nome do viajante" /></label>
        <label className="app-field"><span>E-mail <small>(opcional)</small></span><input name="email" type="email" maxLength={254} placeholder="viajante@exemplo.com" /></label>
        <label className="app-field participant-notes"><span>Observações <small>(opcional)</small></span><input name="notes" maxLength={500} placeholder="Preferências, necessidades ou lembretes" /></label>
      </div>
      {state.message && <p className="app-form-message" role="alert">{state.message}</p>}
      <button className="secondary-action" disabled={pending} type="submit"><UserPlus aria-hidden="true" size={18} /> {pending ? "Adicionando…" : "Adicionar participante"}</button>
    </form>
  );
}
