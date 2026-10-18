import type { Currency } from "@/types/api";

/** Format an amount for display. Cents are shown only when there are any. */
export function formatMoney(value: string | number, currency: Currency): string {
  const amount = typeof value === "string" ? Number(value) : value;
  const hasCents = Math.round(Math.abs(amount) * 100) % 100 !== 0;
  return new Intl.NumberFormat("en", {
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
