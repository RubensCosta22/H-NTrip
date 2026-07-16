"use client";

import { useActionState } from "react";
import { ListPlus } from "lucide-react";
import { initialAccessState } from "@/src/features/access/actions";
import { addChecklistAction } from "./actions";

export function ChecklistForm({ tripId }: { tripId: string }) {
  const [state, action, pending] = useActionState(addChecklistAction, initialAccessState);
  return <form action={action} className="checklist-form"><input name="tripId" type="hidden" value={tripId} /><label className="app-field"><span>Nome da lista</span><input name="name" required maxLength={100} placeholder="Ex.: Mala e documentos" /></label><label className="app-field"><span>Descrição <small>(opcional)</small></span><input name="description" maxLength={500} placeholder="Objetivo desta lista" /></label>{state.message && <p className="app-form-message" role="alert">{state.message}</p>}<button className="secondary-action" disabled={pending} type="submit"><ListPlus aria-hidden="true" size={18} /> {pending ? "Criando…" : "Criar lista"}</button></form>;
}
