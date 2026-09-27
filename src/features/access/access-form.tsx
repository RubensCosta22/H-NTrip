"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import type { AccessActionState } from "./actions";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/client";
import type { SupabasePublicConfig } from "@/src/lib/supabase/config";

type AccessFormProps = {
  action: (state: AccessActionState, formData: FormData) => Promise<AccessActionState>;
  initialState: AccessActionState;
  mode: "login" | "reset" | "update";
  supabaseConfig?: SupabasePublicConfig;
};

export function AccessForm({ action, initialState, mode, supabaseConfig }: AccessFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [resetMessage, setResetMessage] = useState<string>();
  const isLogin = mode === "login";
  const isReset = mode === "reset";

  async function handleReset(formData: FormData) {
    if (!supabaseConfig) {
      setResetMessage("O acesso ainda não foi conectado ao ambiente de validação.");
      return;
    }

    const email = String(formData.get("email") ?? "").trim();
    if (!email) {
      setResetMessage("Informe um e-mail válido.");
      return;
    }

    setResetPending(true);
    setResetMessage(undefined);
    const supabase = createBrowserSupabaseClient(supabaseConfig);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });
    setResetPending(false);
    setResetMessage("Se existir uma conta elegível, enviaremos as instruções para esse e-mail.");
  }

  return (
    <form action={isReset ? handleReset : formAction} className="access-form" noValidate>
      {(isLogin || isReset) && (
        <label className="field-group">
          <span>E-mail</span>
          <span className="field-control">
            <Mail aria-hidden="true" size={20} />
            <input autoComplete="email" inputMode="email" name="email" placeholder="voce@exemplo.com" required type="email" />
          </span>
        </label>
      )}
      {(isLogin || mode === "update") && (
        <label className="field-group">
          <span>{isLogin ? "Senha" : "Nova senha"}</span>
          <span className="field-control">
            <LockKeyhole aria-hidden="true" size={20} />
            <input autoComplete={isLogin ? "current-password" : "new-password"} name="password" required type={showPassword ? "text" : "password"} />
            <button aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} type="button">
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </span>
        </label>
      )}
      {mode === "update" && (
        <label className="field-group">
          <span>Confirmar nova senha</span>
          <span className="field-control">
            <LockKeyhole aria-hidden="true" size={20} />
            <input autoComplete="new-password" name="confirmation" required type="password" />
          </span>
        </label>
      )}
      {(resetMessage || state.message) && (
        <p className={`form-message ${isReset ? "success" : state.status}`} role={state.status === "error" ? "alert" : "status"}>
          {resetMessage ?? state.message}
        </p>
      )}
      <button className="primary-button" disabled={pending || resetPending} type="submit">
        {pending || resetPending ? "Aguarde…" : isLogin ? "Entrar" : isReset ? "Enviar instruções" : "Atualizar senha"}
      </button>
    </form>
  );
}
