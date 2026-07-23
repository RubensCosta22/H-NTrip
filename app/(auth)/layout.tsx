import { AuthShell } from "@/src/features/access/auth-shell";
import "./auth.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
