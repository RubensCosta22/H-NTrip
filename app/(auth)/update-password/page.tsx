import { redirect } from "next/navigation";
import { AccessForm } from "@/src/features/access/access-form";
import { initialAccessState, updatePasswordAction } from "@/src/features/access/actions";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export default async function UpdatePasswordPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password");

  return (
    <section className="auth-card" aria-labelledby="update-title">
      <div>
        <p className="card-kicker">Proteja sua conta</p>
        <h2 id="update-title">Criar nova senha</h2>
        <p className="card-copy">Use 12 caracteres ou mais, incluindo letras, número e símbolo.</p>
      </div>
      <AccessForm action={updatePasswordAction} initialState={initialAccessState} mode="update" />
    </section>
  );
}
