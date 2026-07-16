import Link from "next/link";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { AccountSettingsForm } from "@/src/features/workspace/account-settings-form";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage({ searchParams }: { searchParams: Promise<{ updated?: string }> }) {
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const [{ data: profile }, { data: workspace }, params] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", member.userId).single(),
    supabase.from("workspaces").select("name").eq("id", member.workspaceId).single(),
    searchParams,
  ]);

  return <main className="app-page account-settings-page">
    <div className="settings-tabs"><Link className="active" href="/settings/profile">Perfil</Link><Link href="/settings/access">Acesso</Link></div>
    <div className="page-heading compact"><p className="page-eyebrow">Configurações</p><h1>Conta e workspace</h1><p>Atualize sua identificação e as informações do espaço privado.</p></div>
    {params.updated === "1" && <p className="success-banner" role="status">Configurações atualizadas.</p>}
    <div className="account-settings-layout"><section className="account-settings-panel"><div className="section-heading"><div><p className="page-eyebrow">Identidade</p><h2>Informações principais</h2></div><UserRound aria-hidden="true" /></div><p className="account-email">{member.email} · {member.role === "owner" ? "Proprietária" : "Administradora"}</p><AccountSettingsForm displayName={profile?.display_name ?? ""} workspaceName={workspace?.name ?? "H&NTrip"} canRenameWorkspace={member.role === "owner"} /></section>
      <aside className="security-settings-panel"><ShieldCheck aria-hidden="true" /><h2>Segurança da conta</h2><p>A senha é gerenciada pelo fluxo seguro do Supabase e nunca fica armazenada na aplicação.</p><Link className="app-secondary-link" href="/forgot-password"><KeyRound aria-hidden="true" size={17} /> Redefinir senha</Link><Link className="app-secondary-link" href="/settings/access">Gerenciar acessos</Link></aside></div>
  </main>;
}
