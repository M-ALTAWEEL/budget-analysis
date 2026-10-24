import { ConfirmEmailChangeView } from "@/components/auth/AccountForms";
import { AuthFrame } from "@/components/auth/AuthFrame";

export const metadata = { title: "Confirm your new email · Budget Analysis" };

// Works signed in or not: the link is opened from the new inbox, maybe on another device.
export default function ConfirmEmailChangePage() {
  return (
    <AuthFrame>
      <ConfirmEmailChangeView />
    </AuthFrame>
  );
}
