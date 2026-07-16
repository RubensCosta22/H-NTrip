import Link from "next/link";
import { Bell, LayoutDashboard, LogOut, Plane, Settings } from "lucide-react";
import { logoutAction } from "@/src/features/access/actions";
import { requireCurrentMember } from "@/src/lib/auth/current-member";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await requireCurrentMember();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#app-content">Pular para o conteúdo</a>
      <header className="app-header">
        <Link className="app-wordmark" href="/dashboard">H&amp;N<span>Trip</span></Link>
        <nav aria-label="Navegação principal">
          <Link href="/dashboard"><LayoutDashboard aria-hidden="true" size={18} /><span>Visão geral</span></Link>
          <Link href="/trips"><Plane aria-hidden="true" size={18} /><span>Viagens</span></Link>
          <Link href="/alerts"><Bell aria-hidden="true" size={18} /><span>Alertas</span></Link>
          <Link href="/settings/profile"><Settings aria-hidden="true" size={18} /><span>Configurações</span></Link>
        </nav>
        <div className="account-menu">
          <span>{member.email}</span>
          <form action={logoutAction}><button aria-label="Sair" title="Sair" type="submit"><LogOut aria-hidden="true" size={18} /></button></form>
        </div>
      </header>
      <div id="app-content">{children}</div>
    </div>
  );
}
