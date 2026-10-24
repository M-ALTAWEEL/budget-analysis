"use client";

import { Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuthConfig } from "@/components/auth/AccountForms";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Select } from "@/components/ui/Field";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { sendPhoneCode } from "@/services/auth";
import type { Currency } from "@/types/api";

// Country calling codes for the countries the server allows (Turkey and the Arab League).
const DIAL: Record<string, string> = {
  TR: "90", AE: "971", SA: "966", QA: "974", KW: "965", BH: "973", OM: "968", JO: "962",
  LB: "961", SY: "963", IQ: "964", PS: "970", EG: "20", LY: "218", TN: "216", DZ: "213",
  MA: "212", SD: "249", YE: "967", MR: "222", SO: "252", DJ: "253", KM: "269",
};
const RESEND_SECONDS = 60;

/** "Continue with phone": a button that opens the two steps (number, then code). */
export function PhoneSignIn({ currency = "TRY" }: { currency?: Currency }) {
  const { t } = useI18n();
  const config = useAuthConfig();
  const [open, setOpen] = useState(false);
  if (!config.data?.phone_enabled) return null;

  const countries = config.data.phone_countries.filter((code) => DIAL[code]);
  if (!open) {
    return (
      <Button type="button" variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        <Smartphone className="size-4" aria-hidden />
        {t.account.continuePhone}
      </Button>
    );
  }
  return <PhoneSteps countries={countries} currency={currency} onClose={() => setOpen(false)} />;
}

function PhoneSteps({
  countries,
  currency,
  onClose,
}: {
  countries: string[];
  currency: Currency;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { loginWithPhone } = useAuth();
  const errorMessage = useErrorMessage();
  const intl = LOCALE_INFO[locale].intl;
  const [country, setCountry] = useState(countries.includes("TR") ? "TR" : countries[0]);
  const [number, setNumber] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const names = new Intl.DisplayNames([intl], { type: "region" });
  // People type "0532 123 45 67" or "532 123 45 67": the leading 0 is the local prefix.
  const phone = `+${DIAL[country]}${number.replace(/\D/g, "").replace(/^0+/, "")}`;

  async function send() {
    setError(null);
    setBusy(true);
    try {
      await sendPhoneCode(phone, locale);
      setSentTo(phone);
      setCode("");
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(errorMessage(err, { 422: t.account.phoneInvalid }));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!sentTo) return;
    setError(null);
    setBusy(true);
    try {
      await loginWithPhone(sentTo, code.trim(), { base_currency: currency, locale });
    } catch (err) {
      setError(errorMessage(err, { 400: t.account.phoneCodeWrong }));
      setBusy(false);
    }
  }

  return (
    <div
      className="space-y-4 rounded-2xl border border-line bg-surface p-4"
      // This sits inside the email form: Enter here sends the code, not that form.
      onKeyDown={(event) => {
        if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return;
        event.preventDefault();
        if (!sentTo) void send();
        else if (code.length === 6) void verify();
      }}
    >
      <p className="font-semibold">{t.account.phoneTitle}</p>
      {!sentTo ? (
        <>
          <p className="text-sm text-muted">{t.account.phoneText}</p>
          <Select label={t.account.country} value={country} onChange={(e) => setCountry(e.target.value)}>
            {countries
              .map((code) => ({ code, name: names.of(code) ?? code }))
              .sort((a, b) => a.name.localeCompare(b.name, intl))
              .map(({ code, name }) => (
                <option key={code} value={code}>
                  {name} (+{DIAL[code]})
                </option>
              ))}
          </Select>
          <Field
            label={t.account.phoneNumber}
            type="tel"
            dir="ltr"
            inputMode="tel"
            autoComplete="tel-national"
            suffix={`+${DIAL[country]}`}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
          <FormError message={error} />
          <Button type="button" loading={busy} className="w-full" onClick={() => void send()}>
            {t.account.sendCode}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">
            {/* \u2066…\u2069 keeps "+90…" left-to-right inside an Arabic sentence */}
            {t.account.codeSent(`\u2066${sentTo}\u2069`)}
          </p>
          <Field
            label={t.account.codeLabel}
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <FormError message={error} />
          <Button
            type="button"
            loading={busy}
            disabled={code.length !== 6}
            className="w-full"
            onClick={() => void verify()}
          >
            {t.account.verify}
          </Button>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <button
              type="button"
              disabled={wait > 0 || busy}
              onClick={() => void send()}
              className="font-semibold text-pine underline-offset-4 hover:underline disabled:text-muted disabled:no-underline"
            >
              {wait > 0 ? t.account.resendIn(wait) : t.account.resendCode}
            </button>
            <button
              type="button"
              onClick={() => setSentTo(null)}
              className="font-semibold text-pine underline-offset-4 hover:underline"
            >
              {t.account.changeNumber}
            </button>
          </div>
        </>
      )}
      <button type="button" onClick={onClose} className="text-sm text-muted underline-offset-4 hover:underline">
        {t.account.backToOptions}
      </button>
    </div>
  );
}
