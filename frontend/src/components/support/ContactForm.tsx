"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { SupportForm } from "@/components/support/SupportForm";
import { Field } from "@/components/ui/Field";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { contactSupport } from "@/services/support";

/** For someone who can't sign in (or has no account): answers come by email. */
export function ContactForm() {
  const { t, locale } = useI18n();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">{t.support.contactTitle}</h1>
        <p className="mt-1 text-muted">{t.support.contactIntro}</p>
      </div>
      {sent ? (
        <p className="flex items-center gap-2 rounded-xl bg-pine-soft px-4 py-3 font-semibold text-pine">
          <CheckCircle2 className="size-5" aria-hidden />
          {t.support.contactSent}
        </p>
      ) : (
        <SupportForm
          sending={busy}
          error={error}
          extra={
            <>
              <Field label={t.support.email} type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Field label={t.support.name} autoComplete="name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
            </>
          }
          onSend={async (input) => {
            setError(null);
            setBusy(true);
            try {
              await contactSupport({ ...input, email: email.trim(), name: name.trim() || undefined, locale });
              setSent(true);
              return true;
            } catch (err) {
              setError(errorMessage(err));
              return false;
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      <p className="text-sm">
        <Link href="/login" className="font-semibold text-pine underline-offset-4 hover:underline">
          {t.support.back}
        </Link>
      </p>
    </div>
  );
}
