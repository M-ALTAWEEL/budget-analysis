"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { PageLoader } from "@/components/ui/PageLoader";

/** Login and register pages: signed-in students go straight to their overview. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/overview");
  }, [status, router]);

  if (status !== "anonymous") return <PageLoader />;
  return <>{children}</>;
}
