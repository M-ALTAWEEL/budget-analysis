"use client";

import { MailWarning } from "lucide-react";
import { useState } from "react";

import { useAuthConfig } from "@/components/auth/AccountForms";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { sendVerificationEmail } from "@/services/auth";

/** Shown on every page until the email is confirmed (only where email is switched on). */
export function VerifyEmailBanner() {
  const { t } = useI18n();
  const { user } = useAuth();
  const config = useAuthConfig();
  const errorMessage = useErrorMessage();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!user || user.email_verified || !config.data?.email_enabled) return null;

  async function resend() {
    setError(null);
    setState("sending");
    try {
      await sendVerificationEmail();
      setState("sent");
    } catch (err) {
      setError(errorMessage(err));
      setState("idle");
    }
  }

  return (
    <div role="status" className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
      <MailWarning className="size-5 shrink-0 text-pine" aria-hidden />
      <p className="min-w-0 flex-1">{error ?? (state === "sent" ? t.account.resent : t.account.banner)}</p>
      {state !== "sent" && (
        <button
          type="button"
          onClick={() => void resend()}
          disabled={state === "sending"}
          className="font-semibold text-pine underline-offset-4 hover:underline disabled:opacity-60"
        >
          {t.account.resend}
        </button>
      )}
    </div>
  );
}
