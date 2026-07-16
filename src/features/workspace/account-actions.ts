"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { AccessActionState } from "@/src/features/access/actions";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

const accountSettingsSchema = z.object({
  displayName: z.string().trim().max(120),
  workspaceName: z.string().trim().min(1).max(120),
});

export async function updateAccountSettingsAction(
  _state: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = accountSettingsSchema.safeParse({
    displayName: formData.get("displayName") ?? "",
    workspaceName: formData.get("workspaceName") ?? "",
  });
  if (!parsed.success) return { status: "error", message: "Revise os nomes informados." };
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("update_account_settings", {
    profile_display_name: parsed.data.displayName,
    workspace_name: parsed.data.workspaceName,
  });
  if (error) return { status: "error", message: "Não foi possível salvar. Somente a proprietária pode renomear o workspace." };
  redirect("/settings/profile?updated=1");
}
