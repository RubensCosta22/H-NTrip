"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { initialAccessState } from "@/src/features/access/actions";
import { updateAccountSettingsAction } from "./account-actions";

type AccountSettingsFormProps = {
  displayName: string;
  workspaceName: string;
  canRenameWorkspace: boolean;
};

export function AccountSettingsForm({ displayName, workspaceName, canRenameWorkspace }: AccountSettingsFormProps) {
  const [state, action, pending] = useActionState(updateAccountSettingsAction, initialAccessState);
  return <form action={action} className="account-settings-form"><label className="app-field"><span>Nome de exibição <small>(opcional)</small></span><input name="displayName" defaultValue={displayName} maxLength={120} placeholder="Como deseja aparecer" /></label><label className="app-field"><span>Nome do workspace</span><input name="workspaceName" defaultValue={workspaceName} maxLength={120} required readOnly={!canRenameWorkspace} />{!canRenameWorkspace && <small>Somente uma proprietária pode alterar este nome.</small>}</label>{state.message && <p className="app-form-message" role="alert">{state.message}</p>}<button className="app-primary-button" disabled={pending} type="submit"><Save aria-hidden="true" size={18} /> {pending ? "Salvando…" : "Salvar configurações"}</button></form>;
}
