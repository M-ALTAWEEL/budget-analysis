import { AuthFrame } from "@/components/auth/AuthFrame";
import { AuthGate } from "@/components/auth/AuthGate";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AuthFrame>{children}</AuthFrame>
    </AuthGate>
  );
}
