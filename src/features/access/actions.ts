"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";
import { getAppUrl } from "@/src/lib/app-url";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
});

const emailSchema = z.string().trim().email().max(254);

const passwordSchema = z
  .string()
  .min(12)
  .max(200)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);

export type AccessActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export const initialAccessState: AccessActionState = { status: "idle" };

export async function loginAction(
  _previousState: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Revise o e-mail e a senha informados." };
  }

  if (!isSupabaseConfigured()) {
    return { status: "error", message: "O acesso ainda não foi conectado ao ambiente de validação." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { status: "error", message: "E-mail ou senha inválidos." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = user
    ? await supabase
        .from("workspace_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle()
    : { data: null };

  if (!membership) {
    await supabase.auth.signOut();
    return { status: "error", message: "Esta conta não possui acesso ativo ao H&NTrip." };
  }

  redirect("/dashboard");
}

export async function requestPasswordResetAction(
  _previousState: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: "Informe um e-mail válido." };
  }

  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const appUrl = getAppUrl();
    await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${appUrl}/auth/callback?next=/update-password`,
    });
  }

  return {
    status: "success",
    message: "Se existir uma conta elegível, enviaremos as instruções para esse e-mail.",
  };
}

export async function updatePasswordAction(
  _previousState: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");
  const parsed = passwordSchema.safeParse(password);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Use ao menos 12 caracteres, com maiúscula, minúscula, número e símbolo.",
    };
  }

  if (password !== confirmation) {
    return { status: "error", message: "As senhas não coincidem." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    return { status: "error", message: "Não foi possível atualizar a senha. Solicite um novo link." };
  }

  await supabase.auth.signOut();
  redirect("/login?success=password_updated");
}

export async function logoutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
