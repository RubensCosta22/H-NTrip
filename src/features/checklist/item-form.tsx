"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { initialAccessState } from "@/src/features/access/actions";
import { addChecklistItemAction } from "./actions";

export function ChecklistItemForm({ tripId, checklistId }: { tripId: string; checklistId: string }) {
  const [state, action, pending] = useActionState(addChecklistItemAction, initialAccessState);
  return <form action={action} className="checklist-item-form"><input name="tripId" type="hidden" value={tripId} /><input name="checklistId" type="hidden" value={checklistId} /><div className="checklist-item-grid"><label className="app-field item-title-field"><span>Item</span><input name="title" required maxLength={180} placeholder="Ex.: Separar passaportes" /></label><label className="app-field"><span>Responsável <small>(informativo)</small></span><input name="assigneeName" maxLength={120} placeholder="Nome" /></label><label className="app-field"><span>Prazo <small>(opcional)</small></span><input name="dueDate" type="date" /></label><label className="app-field item-notes-field"><span>Notas <small>(opcional)</small></span><input name="notes" maxLength={1000} placeholder="Detalhes e lembretes" /></label></div>{state.message && <p className="app-form-message" role="alert">{state.message}</p>}<button className="secondary-action" disabled={pending} type="submit"><Plus aria-hidden="true" size={18} /> {pending ? "Adicionando…" : "Adicionar item"}</button></form>;
}
