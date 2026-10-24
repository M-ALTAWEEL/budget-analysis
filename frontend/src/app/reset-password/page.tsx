import { ResetPasswordForm } from "@/components/auth/AccountForms";
import { AuthFrame } from "@/components/auth/AuthFrame";

export const metadata = { title: "Choose a new password · Budget Analysis" };

// Outside the (auth) group on purpose: the link must work even in a browser that is
// signed in (the (auth) pages send signed-in people to their overview).
export default function ResetPasswordPage() {
  return (
    <AuthFrame>
      <ResetPasswordForm />
    </AuthFrame>
  );
}
