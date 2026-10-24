"use client";

import Link from "next/link";
import { useState } from "react";

import { useAuthConfig } from "@/components/auth/AccountForms";
import { useAuth } from "@/components/auth/AuthProvider";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Select } from "@/components/ui/Field";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { CURRENCIES, type Currency } from "@/types/api";

export function LoginForm() {
  const { login } = useAuth();
  const config = useAuthConfig();
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h1 className="font-display text-3xl font-semibold">{t.auth.loginTitle}</h1>
      <GoogleButton />
      <Field
        label={t.auth.email}
        type="email"
        dir="ltr"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Field
        label={t.auth.password}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {config.data?.email_enabled && (
        <p className="-mt-2 text-end text-sm">
          <Link href="/forgot-password" className="font-semibold text-pine underline-offset-4 hover:underline">
            {t.account.forgotLink}
          </Link>
        </p>
      )}
      <FormError message={error} />
      <Button type="submit" loading={busy} className="w-full">
        {t.auth.logIn}
      </Button>
      <p className="text-sm text-muted">
        {t.auth.newHere}{" "}
        <Link href="/register" className="font-semibold text-pine underline-offset-4 hover:underline">
          {t.auth.createOne}
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const { register } = useAuth();
  const { t, locale } = useI18n();
  const errorMessage = useErrorMessage();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) return setError(t.auth.passwordTooShort);
    setBusy(true);
    try {
      await register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        base_currency: currency,
        locale, // the language they are reading now becomes the account's language
      });
    } catch (err) {
      setError(errorMessage(err, { 409: t.errors.emailTaken, 422: t.account.breached }));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h1 className="font-display text-3xl font-semibold">{t.auth.registerTitle}</h1>
      <GoogleButton currency={currency} />
      <Field
        label={t.auth.name}
        autoComplete="name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        required
      />
      <Field
        label={t.auth.email}
        type="email"
        dir="ltr"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Field
        label={t.auth.password}
        type="password"
        autoComplete="new-password"
        hint={t.auth.passwordHint}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Select
        label={t.auth.currency}
        value={currency}
        onChange={(e) => setCurrency(e.target.value as Currency)}
      >
        {CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {t.currencies[code]} ({code})
          </option>
        ))}
      </Select>
      <FormError message={error} />
      <Button type="submit" loading={busy} className="w-full">
        {t.auth.createAccount}
      </Button>
      <p className="text-sm text-muted">
        {t.auth.haveAccount}{" "}
        <Link href="/login" className="font-semibold text-pine underline-offset-4 hover:underline">
          {t.auth.logIn}
        </Link>
      </p>
    </form>
  );
}
