import { AuthShell } from "@/src/features/access/auth-shell";
import "./auth.css";
import "./auth-brand.css";
import "./auth-v2.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
