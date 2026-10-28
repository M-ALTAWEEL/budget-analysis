"use client";

import type { ReactNode } from "react";

import { Select } from "@/components/ui/Field";
import { useCurrencies } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { currencyChoices, currencyLabel } from "@/lib/money";
import type { Currency } from "@/types/api";

/** A currency picker fed by the server's list (admins add currencies). Hidden currencies
 *  are left out, except the chosen one and those in `keep`, which stay usable. */
export function CurrencySelect({
  label,
  value,
  onChange,
  keep = [],
  exclude,
  short = false,
  disabled,
  children,
}: {
  label: string;
  value: Currency;
  onChange: (code: Currency) => void;
  keep?: (Currency | null | undefined)[];
  exclude?: Currency; // e.g. the main currency, in the second-currency picker
  short?: boolean; // "USD" instead of "US dollar (USD)", in narrow forms
  disabled?: boolean;
  children?: ReactNode; // options before the currencies, e.g. "None"
}) {
  const { locale } = useI18n();
  const { data } = useCurrencies();
  const codes = currencyChoices(data, [value, ...keep]).filter((code) => code && code !== exclude);
  return (
    <Select label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {children}
      {codes.map((code) => (
        <option key={code} value={code}>
          {short ? code : currencyLabel(data, code, locale)}
        </option>
      ))}
    </Select>
  );
}
