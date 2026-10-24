"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";

/** The second step of signing in, when two-factor is on: the code from the app. */
export function TwoFactorStep() {
  const { t } = useI18n();
  const { completeTwoFactor, cancelTwoFactor } = useAuth();
  const errorMessage = useErrorMessage();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await completeTwoFactor(code.trim());
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 401) {
        // Too many wrong codes, or too slow: back to the password.
        cancelTwoFactor();
        return;
      }
      setError(errorMessage(err, { 400: t.account.wrongCurrent }));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ShieldCheck className="size-10 text-pine" aria-hidden />
      <h1 className="font-display text-3xl font-semibold">{t.account.stepTitle}</h1>
      <p className="text-muted">{t.account.stepText}</p>
      <Field
        label={t.account.stepCode}
        dir="ltr"
        inputMode="text"
        autoComplete="one-time-code"
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
        minLength={6}
        maxLength={20}
      />
      <FormError message={error} />
      <Button type="submit" loading={busy} className="w-full">
        {t.account.verify}
      </Button>
      <button
        type="button"
        onClick={cancelTwoFactor}
        className="text-sm font-semibold text-pine underline-offset-4 hover:underline"
      >
        {t.account.backToLogin}
      </button>
    </form>
  );
}
