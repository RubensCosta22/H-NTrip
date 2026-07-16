import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { InviteSignupForm } from "@/src/features/access/invite-signup-form";

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) notFound();
  return <section className="auth-card" aria-labelledby="invite-title"><div><p className="card-kicker">Acesso privado</p><h2 id="invite-title">Aceitar convite</h2></div><p className="invite-explanation"><ShieldCheck aria-hidden="true" /> O link é de uso único. Use exatamente o e-mail convidado.</p><InviteSignupForm token={token} /></section>;
}
