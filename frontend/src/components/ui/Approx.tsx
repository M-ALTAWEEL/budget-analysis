"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useRates } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import type { Currency } from "@/types/api";

/**
 * "≈ USD 61.20": the same amount in the student's second currency, at today's rate.
 * Renders nothing when no second currency is chosen, it equals the amount's own
 * currency, or the rates are not loaded (yet, or offline): it is extra information only.
 */
export function Approx({
  amount,
  currency,
  className = "text-sm text-muted",
}: {
  amount: number | string;
  currency: Currency;
  className?: string;
}) {
  const { user } = useAuth();
  const { money } = useI18n();
  const second = user?.secondary_currency ?? null;
  const wanted = second !== null && second !== currency;
  const rates = useRates(currency, wanted);

  if (!wanted || !rates.data) return null;
  const converted = Number(amount) * Number(rates.data.rates[second]);
  return <span className={`tabular block ${className}`}>≈ {money(converted, second)}</span>;
}
