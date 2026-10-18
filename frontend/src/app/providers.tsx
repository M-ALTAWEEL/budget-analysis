"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useEffect } from "react";
import { Toaster } from "sonner";

import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { takeLocalePickedWhileSignedOut } from "@/components/settings/useChangeLocale";
import { I18nProvider, useI18n } from "@/i18n/I18nProvider";
import { updateMe } from "@/services/auth";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";

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

/**
 * Once the student is known, the page and the account agree on one language:
 * - picked on the login screen just now → that choice is saved to the account
 * - otherwise → the account's language wins over the browser's
 */
function AccountLocale() {
  const { user, updateUser } = useAuth();
  const { setLocale } = useI18n();

  useEffect(() => {
    if (!user) return;
    const picked = takeLocalePickedWhileSignedOut();
    if (picked && picked !== user.locale) {
      setLocale(picked);
      updateMe({ locale: picked })
        .then(updateUser)
        .catch(() => {}); // not saved: the page still shows the picked language
    } else {
      setLocale(user.locale);
    }
  }, [user, setLocale, updateUser]);

  return null;
}

function Toasts() {
  const { dir } = useI18n();
  const { resolved } = useTheme();
  return <Toaster position="top-center" dir={dir} theme={resolved} toastOptions={{ className: "font-sans" }} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <QueryClientProvider client={getQueryClient()}>
          {/* "user": animations are skipped for people who turned on reduced motion */}
          <MotionConfig reducedMotion="user">
            <AuthProvider>
              <AccountLocale />
              {children}
            </AuthProvider>
          </MotionConfig>
          <Toasts />
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
