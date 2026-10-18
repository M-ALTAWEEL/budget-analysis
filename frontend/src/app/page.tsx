"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Landing } from "@/components/landing/Landing";
import { PageLoader } from "@/components/ui/PageLoader";

// Visitors see what Budget Analysis is; signed-in students go straight to their overview.
export default function Home() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/overview");
  }, [status, router]);

  return status === "anonymous" ? <Landing /> : <PageLoader />;
}
