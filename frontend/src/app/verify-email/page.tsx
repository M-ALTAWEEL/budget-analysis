import { VerifyEmailView } from "@/components/auth/AccountForms";
import { AuthFrame } from "@/components/auth/AuthFrame";

export const metadata = { title: "Confirm your email · Budget Analysis" };

// Works signed in or not: people often open the email on another device.
export default function VerifyEmailPage() {
  return (
    <AuthFrame>
      <VerifyEmailView />
    </AuthFrame>
  );
}
