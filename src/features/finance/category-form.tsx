"use client";

import { useActionState } from "react";
import { Tags } from "lucide-react";
import { initialAccessState } from "@/src/features/access/actions";
import { addExpenseCategoryAction } from "./actions";

export function ExpenseCategoryForm({ tripId }: { tripId: string }) {
  const [state, action, pending] = useActionState(addExpenseCategoryAction, initialAccessState);
  return (
    <form action={action} className="category-form">
      <input name="tripId" type="hidden" value={tripId} />
      <label className="app-field"><span>Nome</span><input name="name" required maxLength={80} placeholder="Ex.: Alimentação" /></label>
      <label className="app-field color-field"><span>Cor</span><input aria-label="Cor da categoria" name="color" type="color" defaultValue="#43C6D9" /></label>
      {state.message && <p className="app-form-message" role="alert">{state.message}</p>}
      <button className="secondary-action" disabled={pending} type="submit"><Tags aria-hidden="true" size={18} /> {pending ? "Criando…" : "Criar categoria"}</button>
    </form>
  );
}
