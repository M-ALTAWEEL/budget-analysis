"use client";

import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Select } from "@/components/ui/Field";
import { errorMessage } from "@/lib/errors";
import { CURRENCIES, type Currency } from "@/types/api";

const CURRENCY_NAMES: Record<Currency, string> = {
  TRY: "Turkish lira",
  USD: "US dollar",
  AED: "UAE dirham",
  SAR: "Saudi riyal",
  QAR: "Qatari riyal",
  EUR: "Euro",
};

export function LoginForm() {
  const { login } = useAuth();
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
      <h1 className="font-display text-3xl font-semibold">Log in</h1>
      <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Field
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <FormError message={error} />
      <Button type="submit" loading={busy} className="w-full">
        Log in
      </Button>
      <p className="text-sm text-muted">
        New here?{" "}
        <Link href="/register" className="font-semibold text-pine underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password: use at least 8 characters.");
    setBusy(true);
    try {
      await register({ full_name: fullName.trim(), email: email.trim(), password, base_currency: currency });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h1 className="font-display text-3xl font-semibold">Create your account</h1>
      <Field label="Name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Field
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Select label="Your allowance currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
        {CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {CURRENCY_NAMES[code]} ({code})
          </option>
        ))}
      </Select>
      <FormError message={error} />
      <Button type="submit" loading={busy} className="w-full">
        Create account
      </Button>
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-pine underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
