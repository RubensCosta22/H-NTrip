"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import type { AccessActionState } from "./actions";

type AccessFormProps = {
  action: (state: AccessActionState, formData: FormData) => Promise<AccessActionState>;
  initialState: AccessActionState;
  mode: "login" | "reset" | "update";
};

export function AccessForm({ action, initialState, mode }: AccessFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const isLogin = mode === "login";
  const isReset = mode === "reset";

  return (
    <form action={formAction} className="access-form" noValidate>
      {(isLogin || isReset) && (
        <label className="field-group">
          <span>E-mail</span>
          <span className="field-control">
            <Mail aria-hidden="true" size={20} />
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              placeholder="voce@exemplo.com"
              required
              type="email"
            />
          </span>
        </label>
      )}

      {(isLogin || mode === "update") && (
        <label className="field-group">
          <span>{isLogin ? "Senha" : "Nova senha"}</span>
          <span className="field-control">
            <LockKeyhole aria-hidden="true" size={20} />
            <input
              autoComplete={isLogin ? "current-password" : "new-password"}
              name="password"
              required
              type={showPassword ? "text" : "password"}
            />
            <button
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              type="button"
            >
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

      {state.message && (
        <p className={`form-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      )}

      <button className="primary-button" disabled={pending} type="submit">
        {pending
          ? "Aguarde…"
          : isLogin
            ? "Entrar"
            : isReset
              ? "Enviar instruções"
              : "Atualizar senha"}
      </button>
    </form>
  );
}
