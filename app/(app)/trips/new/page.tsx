import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TripForm } from "@/src/features/trips/trip-form";
import { requireCurrentMember } from "@/src/lib/auth/current-member";

export const dynamic = "force-dynamic";

export default async function NewTripPage() {
  await requireCurrentMember();
  return (
    <main className="app-page">
      <div className="page-heading compact">
        <Link href="/trips" className="back-link"><ArrowLeft aria-hidden="true" size={18} /> Viagens</Link>
        <p className="page-eyebrow">Novo planejamento</p>
        <h1>Criar viagem</h1>
        <p>Comece pelas informações essenciais. O roteiro, os gastos e o checklist entram depois.</p>
      </div>
      <section className="form-surface"><TripForm /></section>
    </main>
  );
}
