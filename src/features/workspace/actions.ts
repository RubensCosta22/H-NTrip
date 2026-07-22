"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export type InviteActionState = { status: "idle" | "error" | "success"; message?: string; inviteUrl?: string; expiresAt?: string };
export const initialInviteState: InviteActionState = { status: "idle" };
const inviteSchema = z.object({ email: z.email().max(254), role: z.enum(["owner", "admin"]) });

export async function createInviteAction(_state: InviteActionState, formData: FormData): Promise<InviteActionState> {
  const parsed = inviteSchema.safeParse({ email: String(formData.get("email") ?? "").trim(), role: formData.get("role") });
  if (!parsed.success) return { status: "error", message: "Informe um e-mail e um papel válidos." };
  const member = await requireCurrentMember();
  if (member.role !== "owner") return { status: "error", message: "Somente a proprietária pode criar convites." };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_workspace_invite", { invited_email: parsed.data.email, invited_role: parsed.data.role });
  const invite = Array.isArray(data) ? data[0] : data;
  if (error || !invite?.raw_token) return { status: "error", message: "Não foi possível criar. Pode existir um convite ativo para este e-mail." };
  return { status: "success", message: "Convite criado. Copie o link agora; o token não será exibido novamente.", inviteUrl: `/accept-invite?token=${invite.raw_token}`, expiresAt: invite.expires_at };
}

export async function revokeInviteAction(formData: FormData) {
  const parsed = z.uuid().safeParse(formData.get("inviteId"));
  if (!parsed.success) redirect("/settings/access");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("revoke_workspace_invite", { target_invite_id: parsed.data });
  redirect(`/settings/access${error ? "?error=invite_revoke_failed" : "?invite=revoked"}`);
}

export async function deactivateMemberAction(formData: FormData) {
  const parsed = z.uuid().safeParse(formData.get("membershipId"));
  if (!parsed.success) redirect("/settings/access");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("deactivate_workspace_member", { target_membership_id: parsed.data });
  redirect(`/settings/access${error ? "?error=deactivate_failed" : "?member=deactivated"}`);
}
