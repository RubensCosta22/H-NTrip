"use client";

import { useActionState, useRef } from "react";
import { ReceiptText } from "lucide-react";
import { initialAccessState } from "@/src/features/access/actions";
import { addExpenseAction } from "./actions";

type Category = { id: string; name: string; color: string };

export function ExpenseForm({ tripId, categories }: { tripId: string; categories: Category[] }) {
  const [state, action, pending] = useActionState(addExpenseAction, initialAccessState);
  const idempotencyInput = useRef<HTMLInputElement>(null);

  return (
    <form action={action} className="expense-form" onSubmit={() => {
      if (idempotencyInput.current && !idempotencyInput.current.value) {
        idempotencyInput.current.value = globalThis.crypto.randomUUID();
      }
    }}>
      <input name="tripId" type="hidden" value={tripId} />
      <input name="idempotencyKey" ref={idempotencyInput} type="hidden" />
      <div className="expense-form-grid">
        <label className="app-field expense-description"><span>Descrição</span><input name="description" required maxLength={180} placeholder="Ex.: Jantar no centro" /></label>
        <label className="app-field"><span>Categoria</span><select name="categoryId" required defaultValue=""><option value="" disabled>Selecione</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label className="app-field"><span>Data</span><input name="date" type="date" required /></label>
        <label className="app-field"><span>Valor</span><input name="amount" inputMode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" placeholder="0,00" required /></label>
        <label className="app-field expense-merchant"><span>Estabelecimento <small>(opcional)</small></span><input name="merchant" maxLength={120} placeholder="Nome do estabelecimento" /></label>
      </div>
      {state.message && <p className="app-form-message" role="alert">{state.message}</p>}
      <button className="app-primary-button" disabled={pending || categories.length === 0} type="submit"><ReceiptText aria-hidden="true" size={18} /> {pending ? "Registrando…" : "Registrar gasto"}</button>
      {categories.length === 0 && <p className="form-hint">Crie uma categoria antes de registrar o primeiro gasto.</p>}
    </form>
  );
}
