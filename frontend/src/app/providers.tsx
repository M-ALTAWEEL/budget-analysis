"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";

import { AuthProvider } from "@/components/auth/AuthProvider";

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  const create = () =>
    new QueryClient({
      defaultOptions: {
        queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
      },
    });
  // A fresh client per server render; one shared client in the browser.
  if (typeof window === "undefined") return create();
  browserQueryClient ??= create();
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {/* "user": animations are skipped for people who turned on reduced motion */}
      <MotionConfig reducedMotion="user">
        <AuthProvider>{children}</AuthProvider>
      </MotionConfig>
      <Toaster position="top-center" toastOptions={{ className: "font-sans" }} />
    </QueryClientProvider>
  );
}
