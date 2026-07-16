"use client";

import { useActionState } from "react";
import { LockKeyhole, Mail, UserPlus } from "lucide-react";
import { initialAccessState } from "./actions";
import { acceptInviteSignupAction } from "./invite-actions";

export function InviteSignupForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInviteSignupAction, initialAccessState);
  return <form action={action} className="access-form"><input name="token" type="hidden" value={token} /><label className="field-group"><span>E-mail convidado</span><span className="field-control"><Mail aria-hidden="true" /><input name="email" type="email" required autoComplete="email" /></span></label><label className="field-group"><span>Senha</span><span className="field-control"><LockKeyhole aria-hidden="true" /><input name="password" type="password" required minLength={12} autoComplete="new-password" /></span></label><label className="field-group"><span>Confirmar senha</span><span className="field-control"><LockKeyhole aria-hidden="true" /><input name="confirmation" type="password" required minLength={12} autoComplete="new-password" /></span></label>{state.message && <p className={`form-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}<button className="primary-button" disabled={pending} type="submit"><UserPlus aria-hidden="true" size={18} /> {pending ? "Ativando…" : "Criar conta e aceitar"}</button></form>;
}
