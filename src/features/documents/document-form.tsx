"use client";

import { useActionState } from "react";
import { FilePlus2 } from "lucide-react";
import { initialAccessState } from "@/src/features/access/actions";
import { addTripDocumentAction } from "./actions";

export function DocumentForm({ tripId }: { tripId: string }) {
  const [state, action, pending] = useActionState(addTripDocumentAction, initialAccessState);
  return (
    <form action={action} className="document-form">
      <input name="tripId" type="hidden" value={tripId} />
      <div className="document-form-grid">
        <label className="app-field document-title-field"><span>Documento</span><input name="title" required maxLength={140} placeholder="Ex.: Passaporte do viajante" /></label>
        <label className="app-field"><span>Categoria</span><select name="category" defaultValue="identity"><option value="identity">Identificação</option><option value="reservation">Reserva</option><option value="insurance">Seguro</option><option value="transport">Transporte</option><option value="health">Saúde</option><option value="other">Outro</option></select></label>
        <label className="app-field"><span>Titular <small>(opcional)</small></span><input name="holderName" maxLength={120} placeholder="Nome do titular" /></label>
        <label className="app-field"><span>Emissão <small>(opcional)</small></span><input name="issuedOn" type="date" /></label>
        <label className="app-field"><span>Validade <small>(opcional)</small></span><input name="expiresOn" type="date" /></label>
        <label className="app-field document-notes-field"><span>Observações <small>(opcional)</small></span><textarea name="notes" rows={3} maxLength={1000} placeholder="Lembretes úteis, sem incluir senhas ou dados bancários" /></label>
      </div>
      {state.message && <p className="app-form-message" role="alert">{state.message}</p>}
      <button className="app-primary-button" disabled={pending} type="submit"><FilePlus2 aria-hidden="true" size={18} /> {pending ? "Salvando…" : "Adicionar documento"}</button>
    </form>
  );
}
