"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { FormError } from "@/components/ui/Field";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { getAuthConfig } from "@/services/auth";
import { useTheme } from "@/theme/ThemeProvider";
import type { Currency } from "@/types/api";

// The few parts of Google Identity Services (accounts.google.com/gsi/client) we use.
interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (r: { credential: string }) => void }): void;
      renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

const SCRIPT_URL = "https://accounts.google.com/gsi/client";
let scriptLoading: Promise<void> | null = null;

/** Loads Google's script once, however many buttons ask for it. */
function loadGoogleScript(): Promise<void> {
  scriptLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoading = null; // allow a retry later
      reject(new Error("Google script failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

/**
 * Google's own "Continue with Google" button (their design rules require their button).
 * Hidden when the server has no Google client ID, or when Google cannot be reached:
 * email and password always work.
 * `currency` is only used if this creates a new account.
 */
export function GoogleButton({ currency = "TRY" }: { currency?: Currency }) {
  const config = useQuery({ queryKey: ["auth-config"], queryFn: getAuthConfig, staleTime: Infinity });
  const clientId = config.data?.google_client_id;
  const { loginWithGoogle } = useAuth();
  const { t, locale } = useI18n();
  const { resolved: theme } = useTheme();
  const errorMessage = useErrorMessage();
  const boxRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google calls back once; it must use the currency and language chosen by then.
  const latest = useRef({ currency, locale, loginWithGoogle, errorMessage });
  useEffect(() => {
    latest.current = { currency, locale, loginWithGoogle, errorMessage };
  });

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        const box = boxRef.current;
        const google = window.google;
        if (cancelled || !box || !google) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            setError(null);
            const { currency, locale, loginWithGoogle, errorMessage } = latest.current;
            try {
              await loginWithGoogle(credential, { base_currency: currency, locale });
            } catch (err) {
              setError(errorMessage(err));
            }
          },
        });
        box.replaceChildren(); // re-drawn when the language or theme changes
        google.accounts.id.renderButton(box, {
          type: "standard",
          theme: theme === "dark" ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          logo_alignment: "center",
          locale: LOCALE_INFO[locale].intl.split("-")[0],
          width: Math.min(box.clientWidth || 400, 400), // Google's maximum
        });
        setReady(true);
      })
      .catch(() => setReady(false));
    return () => {
      cancelled = true;
    };
  }, [clientId, locale, theme]);

  if (!clientId) return null;

  return (
    // Not display:none while loading: the button needs the real width to draw itself.
    <div className={ready ? "" : "invisible h-0 overflow-hidden"}>
      <div ref={boxRef} className="flex min-h-11 w-full justify-center" />
      <FormError message={error} />
      <div className="my-5 flex items-center gap-3 text-sm text-muted" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        {t.auth.or}
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
