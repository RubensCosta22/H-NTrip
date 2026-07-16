"use client";

import { useActionState } from "react";
import { Copy, UserPlus } from "lucide-react";
import { createInviteAction, initialInviteState } from "./actions";

export function InviteForm() {
  const [state, action, pending] = useActionState(createInviteAction, initialInviteState);
  return <form action={action} className="invite-admin-form"><div className="invite-fields"><label className="app-field"><span>E-mail</span><input name="email" type="email" required maxLength={254} placeholder="pessoa@exemplo.com" /></label><label className="app-field"><span>Papel</span><select name="role" defaultValue="admin"><option value="admin">Administradora</option><option value="owner">Proprietária</option></select></label></div>{state.message && <p className={state.status === "success" ? "success-banner" : "app-form-message"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}{state.inviteUrl && <div className="generated-invite"><code>{state.inviteUrl}</code><button onClick={() => navigator.clipboard.writeText(`${location.origin}${state.inviteUrl}`)} type="button"><Copy aria-hidden="true" size={16} /> Copiar link</button></div>}<button className="app-primary-button" disabled={pending} type="submit"><UserPlus aria-hidden="true" size={18} /> {pending ? "Criando…" : "Criar convite"}</button></form>;
}
