"use client";

import { useActionState, useRef, useState } from "react";
import { initialAccessState } from "@/src/features/access/actions";
import { confirmPlannedExpenseAction } from "./actions";

export function ConfirmExpenseForm({ tripId, planId, amount, date }: { tripId: string; planId: string; amount: string; date: string }) {
  const [state, action, pending] = useActionState(confirmPlannedExpenseAction, initialAccessState);
  const [actualAmount, setActualAmount] = useState(amount.replace(".", ","));
  const [actualDate, setActualDate] = useState(date);
  const requestKey = useRef("");
  const request = useRef<HTMLInputElement>(null);
  return <form action={action} className="planned-confirm-form" onSubmit={() => {
    if (!requestKey.current) requestKey.current = globalThis.crypto.randomUUID();
    if (request.current) request.current.value = requestKey.current;
  }}>
    <input type="hidden" name="tripId" value={tripId} />
    <input type="hidden" name="expenseId" value={planId} />
    <input type="hidden" name="idempotencyKey" ref={request} />
    <label className="app-field"><span>Valor realizado</span><input name="amount" value={actualAmount} onChange={(event) => setActualAmount(event.target.value)} inputMode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" required /></label>
    <label className="app-field"><span>Data do pagamento</span><input name="date" type="date" value={actualDate} onChange={(event) => setActualDate(event.target.value)} required /></label>
    <p className="form-hint">A estimativa original será preservada. Confirme somente após pagar.</p>
    {state.message && <p role="alert" className="app-form-message">{state.message}</p>}
    <button type="submit" className="app-primary-button" disabled={pending}>{pending ? "Confirmando…" : "Confirmar valor realizado"}</button>
  </form>;
}
