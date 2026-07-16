import Link from "next/link";
import { ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import { InviteForm } from "@/src/features/workspace/invite-form";
import { deactivateMemberAction, revokeInviteAction } from "@/src/features/workspace/actions";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
type AccessSettingsProps = { searchParams: Promise<{ invite?: string; member?: string; error?: string }> };

export default async function AccessSettingsPage({ searchParams }: AccessSettingsProps) {
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const [{ data: workspace }, { data: memberships }, { data: invites }, notices] = await Promise.all([
    supabase.from("workspaces").select("name").eq("id", member.workspaceId).single(),
    supabase.from("workspace_members").select("id, user_id, role, status, joined_at, created_at").eq("workspace_id", member.workspaceId).order("created_at", { ascending: true }),
    supabase.from("workspace_invites").select("id, email, role, expires_at, created_at").eq("workspace_id", member.workspaceId).is("used_at", null).is("revoked_at", null).order("created_at", { ascending: false }),
    searchParams,
  ]);
  const userIds = memberships?.map((membership) => membership.user_id) ?? [];
  const { data: profiles } = userIds.length ? await supabase.from("profiles").select("id, display_name").in("id", userIds) : { data: [] as { id: string; display_name: string | null }[] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const activeMembers = memberships?.filter((membership) => membership.status === "active") ?? [];

  return <main className="app-page access-settings-page"><div className="settings-tabs"><Link href="/settings/profile">Perfil</Link><Link className="active" href="/settings/access">Acesso</Link></div><div className="page-heading compact"><p className="page-eyebrow">Administração</p><h1>Acesso ao workspace</h1><p>Gerencie quem pode entrar em {workspace?.name ?? "seu workspace"}. Participantes das viagens continuam apenas informativos.</p></div>{notices.invite === "revoked" && <p className="success-banner">Convite revogado.</p>}{notices.member === "deactivated" && <p className="success-banner">Membro desativado.</p>}{notices.error && <p className="app-form-message">Não foi possível desativar o membro.</p>}
    <section className="access-summary"><article><Users aria-hidden="true" /><div><strong>{activeMembers.length}</strong><span>membros ativos</span></div></article><article><ShieldCheck aria-hidden="true" /><div><strong>{activeMembers.filter((item) => item.role === "owner").length}</strong><span>proprietárias</span></div></article></section>
    {member.role === "owner" && <section className="invite-admin-panel"><div className="section-heading"><div><p className="page-eyebrow">Uso único · 7 dias</p><h2>Novo convite</h2></div><ShieldCheck aria-hidden="true" /></div><InviteForm /></section>}
    <div className="access-management-grid"><section className="member-admin-panel"><div className="section-heading"><div><p className="page-eyebrow">Pessoas</p><h2>Membros</h2></div><Users aria-hidden="true" /></div><div className="member-admin-list">{activeMembers.map((item) => <article key={item.id}><div className="member-admin-avatar"><UserRound aria-hidden="true" /></div><div><strong>{item.user_id === member.userId ? member.email : names.get(item.user_id) || "Membro do workspace"}</strong><span>{item.role === "owner" ? "Proprietária" : "Administradora"}</span></div>{member.role === "owner" && item.user_id !== member.userId && <form action={deactivateMemberAction}><input name="membershipId" type="hidden" value={item.id} /><button aria-label="Desativar membro" type="submit"><Trash2 aria-hidden="true" size={17} /></button></form>}</article>)}</div></section>
      <section className="invite-list-panel"><div className="section-heading"><div><p className="page-eyebrow">Pendentes</p><h2>Convites ativos</h2></div></div><div className="pending-invite-list">{invites?.length ? invites.map((invite) => <article key={invite.id}><div><strong>{invite.email}</strong><span>{invite.role === "owner" ? "Proprietária" : "Administradora"} · expira {new Intl.DateTimeFormat("pt-BR").format(new Date(invite.expires_at))}</span></div>{member.role === "owner" && <form action={revokeInviteAction}><input name="inviteId" type="hidden" value={invite.id} /><button type="submit">Revogar</button></form>}</article>) : <p>Nenhum convite pendente.</p>}</div></section></div>
  </main>;
}
