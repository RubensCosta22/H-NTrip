import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export type CurrentMember = {
  userId: string;
  email: string;
  workspaceId: string;
  role: "owner" | "admin";
};

export async function requireCurrentMember(): Promise<CurrentMember> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    await supabase.auth.signOut();
    redirect("/login?error=access_denied");
  }

  return {
    userId: user.id,
    email: user.email ?? "Conta sem e-mail",
    workspaceId: membership.workspace_id,
    role: membership.role,
  };
}
