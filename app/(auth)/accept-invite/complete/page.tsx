import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export default async function CompleteInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) redirect("/login?error=invalid_invite");
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?error=invalid_invite`);
  const { error } = await supabase.rpc("accept_workspace_invite", { invite_token: token });
  if (error) { await supabase.auth.signOut(); redirect("/login?error=invalid_invite"); }
  redirect("/dashboard");
}
