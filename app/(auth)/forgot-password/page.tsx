import Link from "next/link";
import { AccessForm } from "@/src/features/access/access-form";
import { initialAccessState, requestPasswordResetAction } from "@/src/features/access/actions";
import { getSupabasePublicConfig, isSupabaseConfigured } from "@/src/lib/supabase/config";

export default function ForgotPasswordPage() {
  const supabaseConfig = isSupabaseConfigured() ? getSupabasePublicConfig() : undefined;

  return (
    <section className="auth-card" aria-labelledby="reset-title">
      <div>
        <p className="card-kicker">Recuperação segura</p>
        <h2 id="reset-title">Redefinir senha</h2>
        <p className="card-copy">Informe seu e-mail para receber as instruções.</p>
      </div>
      <AccessForm action={requestPasswordResetAction} initialState={initialAccessState} mode="reset" supabaseConfig={supabaseConfig} />
      <Link className="recovery-link" href="/login">Voltar para o login</Link>
    </section>
  );
}
