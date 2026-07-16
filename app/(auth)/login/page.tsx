import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { AccessForm } from "@/src/features/access/access-form";
import { initialAccessState, loginAction } from "@/src/features/access/actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const notice =
    params.error === "access_denied"
      ? "Sua sessão é válida, mas esta conta não possui acesso ativo."
      : params.error === "invalid_invite"
        ? "O convite é inválido, expirou ou já foi utilizado."
      : params.success === "password_updated"
        ? "Senha atualizada. Entre novamente para continuar."
        : undefined;

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <div>
        <p className="card-kicker">Bem-vinda de volta</p>
        <h2 id="login-title">Entrar</h2>
      </div>
      {notice && <p className="form-message success" role="status">{notice}</p>}
      <AccessForm action={loginAction} initialState={initialAccessState} mode="login" />
      <Link className="recovery-link" href="/forgot-password">Esqueci minha senha</Link>
      <div className="invite-notice">
        <LockKeyhole aria-hidden="true" size={19} />
        <span>Acesso somente por convite</span>
      </div>
    </section>
  );
}
