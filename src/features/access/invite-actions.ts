"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { AccessActionState } from "./actions";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

const inviteSignupSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  email: z.email().max(254),
  password: z.string().min(12).max(200).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
  confirmation: z.string(),
});

export async function acceptInviteSignupAction(_state: AccessActionState, formData: FormData): Promise<AccessActionState> {
  const parsed = inviteSignupSchema.safeParse({ token: formData.get("token"), email: String(formData.get("email") ?? "").trim(), password: formData.get("password"), confirmation: formData.get("confirmation") });
  if (!parsed.success || parsed.data.password !== parsed.data.confirmation) return { status: "error", message: "Revise o e-mail e use uma senha de 12 caracteres com maiúscula, minúscula, número e símbolo." };
  const supabase = await createServerSupabaseClient();
  const { data: valid } = await supabase.rpc("validate_workspace_invite", { invite_token: parsed.data.token, invited_email: parsed.data.email });
  if (!valid) return { status: "error", message: "Convite inválido, expirado ou já utilizado." };

  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const completion = `/accept-invite/complete?token=${parsed.data.token}`;
  const { data, error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(completion)}` } });
  if (error) return { status: "error", message: "Não foi possível criar a conta para este convite." };
  if (data.session) {
    const { error: acceptError } = await supabase.rpc("accept_workspace_invite", { invite_token: parsed.data.token });
    if (acceptError) return { status: "error", message: "A conta foi criada, mas o convite não pôde ser ativado." };
    redirect("/dashboard");
  }
  return { status: "success", message: "Conta criada. Confirme o e-mail para concluir o acesso." };
}
