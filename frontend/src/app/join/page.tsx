import { Suspense } from "react";

import { AuthFrame } from "@/components/auth/AuthFrame";
import { JoinView } from "@/components/groups/JoinView";
import { PageLoader } from "@/components/ui/PageLoader";

export const metadata = { title: "Join a group · Budget Analysis" };

// Works signed in or not: signed-out visitors are sent to log in, then brought back.
export default function JoinPage() {
  return (
    <AuthFrame>
      <Suspense fallback={<PageLoader />}>
        <JoinView />
      </Suspense>
    </AuthFrame>
  );
}
