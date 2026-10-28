import type { Currency, CurrencyInfo, Locale } from "@/types/api";

/** "Turkish lira (TRY)" in the person's language; just "TRY" while the list is loading. */
export function currencyLabel(list: CurrencyInfo[] | undefined, code: Currency, locale: Locale): string {
  const name = list?.find((c) => c.code === code)?.names[locale];
  return name ? `${name} (${code})` : code;
}

/** What a currency picker offers: the visible currencies, plus the ones in `keep` even when
 *  hidden (the one already chosen, their main currency: those stay theirs), so the field
 *  never looks empty. */
export function currencyChoices(
  list: CurrencyInfo[] | undefined,
  keep: (Currency | null | undefined)[] = [],
): Currency[] {
  const kept = keep.filter((code): code is Currency => !!code);
  const codes = (list ?? []).filter((c) => !c.hidden || kept.includes(c.code)).map((c) => c.code);
  return [...new Set([...kept.filter((code) => !codes.includes(code)), ...codes])];
}

/** Format an amount for display. Cents are shown only when there are any.
 *  `intl` is the language's Intl tag: "en" -> "TRY 8,000", "tr" -> "8.000 TRY". */
export function formatMoney(value: string | number, currency: Currency, intl = "en"): string {
  const amount = typeof value === "string" ? Number(value) : value;
  const hasCents = Math.round(Math.abs(amount) * 100) % 100 !== 0;
  return new Intl.NumberFormat(intl, {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** An API amount as the person would type it: "8000.00" -> "8000", "12.50" stays. */
export function toInputAmount(value: string): string {
  return value.replace(/\.00$/, "");
}

/** Accepts what a person types: "12", "12.5", "12.50". Rejects "12.505" and "-3". */
export const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

export function isValidAmount(value: string): boolean {
  return AMOUNT_PATTERN.test(value.trim()) && Number(value) > 0;
}
