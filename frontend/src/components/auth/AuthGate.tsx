"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { PageLoader } from "@/components/ui/PageLoader";
import { takePendingInvite } from "@/lib/pendingInvite";

/** Login and register pages: signed-in students go to their overview (or a pending invite). */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated") return;
    // Opened an invite link while signed out: go back to it.
    const invite = takePendingInvite();
    router.replace(invite ? `/join?token=${encodeURIComponent(invite)}` : "/overview");
  }, [status, router]);

  if (status !== "anonymous") return <PageLoader />;
  return <>{children}</>;
}
