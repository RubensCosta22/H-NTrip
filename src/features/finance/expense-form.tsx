"use client";

import { useActionState, useRef, useState } from "react";
import { ReceiptText } from "lucide-react";
import { initialAccessState } from "@/src/features/access/actions";
import { addExpenseAction } from "./actions";

type Category = { id: string; name: string; color: string };

export function ExpenseForm({ tripId, categories }: { tripId: string; categories: Category[] }) {
  const [state, action, pending] = useActionState(addExpenseAction, initialAccessState);
  const [fields, setFields] = useState({ description: "", categoryId: "", date: "", amount: "", merchant: "" });
  const requestKey = useRef("");
  const [kind, setKind] = useState("planned");
  const idempotencyInput = useRef<HTMLInputElement>(null);

  return (
    <form action={action} className="expense-form" onSubmit={() => {
      if (!requestKey.current) requestKey.current = globalThis.crypto.randomUUID();
      if (idempotencyInput.current) idempotencyInput.current.value = requestKey.current;
    }}>
      <input name="tripId" type="hidden" value={tripId} />
      <input name="idempotencyKey" ref={idempotencyInput} type="hidden" />
      <label className="app-field"><span>Tipo de lançamento</span><select name="kind" value={kind} onChange={(event) => { setKind(event.target.value);  }}><option value="planned">Previsto — ainda vou pagar</option><option value="actual">Realizado — já paguei</option></select></label>
      <p className="form-hint">{kind === "planned" ? "Guarde a estimativa e confirme o valor real depois do pagamento." : "Este valor entra imediatamente nos gastos realizados."}</p>
      <div className="expense-form-grid">
        <label className="app-field expense-description"><span>Descrição</span><input name="description" value={fields.description} onChange={(event) => setFields({ ...fields, description: event.target.value })} required maxLength={180} placeholder="Ex.: Jantar no centro" /></label>
        <label className="app-field"><span>Categoria</span><select name="categoryId" required value={fields.categoryId} onChange={(event) => setFields({ ...fields, categoryId: event.target.value })}><option value="" disabled>Selecione</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label className="app-field"><span>{kind === "planned" ? "Data prevista" : "Data do pagamento"}</span><input name="date" value={fields.date} onChange={(event) => setFields({ ...fields, date: event.target.value })} type="date" required /></label>
        <label className="app-field"><span>{kind === "planned" ? "Valor previsto" : "Valor realizado"}</span><input name="amount" value={fields.amount} onChange={(event) => setFields({ ...fields, amount: event.target.value })} inputMode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" placeholder="0,00" required /></label>
        <label className="app-field expense-merchant"><span>Estabelecimento <small>(opcional)</small></span><input name="merchant" value={fields.merchant} onChange={(event) => setFields({ ...fields, merchant: event.target.value })} maxLength={120} placeholder="Nome do estabelecimento" /></label>
      </div>
      {state.message && <p className="app-form-message" role="alert">{state.message}</p>}
      <button className="app-primary-button" disabled={pending || categories.length === 0} type="submit"><ReceiptText aria-hidden="true" size={18} /> {pending ? "Registrando…" : kind === "planned" ? "Salvar previsto" : "Registrar realizado"}</button>
      {categories.length === 0 && <p className="form-hint">Crie uma categoria antes de registrar o primeiro gasto.</p>}
    </form>
  );
}
