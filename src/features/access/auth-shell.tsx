import { LockKeyhole } from "lucide-react";
import Link from "next/link";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <div className="auth-backdrop" aria-hidden="true" />
      <header className="auth-header">
        <Link className="wordmark" href="/" aria-label="H&NTrip — início">
          H&amp;N<span>Trip</span>
        </Link>
        <p><LockKeyhole aria-hidden="true" size={18} /> Acesso privado</p>
      </header>
      <section className="auth-content">
        <div className="auth-hero">
          <p className="eyebrow">Planejamento compartilhado</p>
          <h1>Sua próxima viagem começa aqui.</h1>
          <p>Planeje, compartilhe e viva cada detalhe em um só lugar.</p>
        </div>
        {children}
      </section>
    </main>
  );
}
