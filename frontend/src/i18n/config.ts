// The languages BudgetBuddy speaks. The same codes are stored on the user (users.locale).

export const LOCALES = ["en", "ar", "tr"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Saved in the browser so the right language shows before the student logs in. */
export const LOCALE_STORAGE_KEY = "bb-locale";

export const LOCALE_INFO: Record<
  Locale,
  { label: string; dir: "ltr" | "rtl"; intl: string; flag: "gb" | "sa" | "tr" }
> = {
  en: { label: "English", dir: "ltr", intl: "en", flag: "gb" },
  // "nu-latn": Latin digits (8,000) instead of Arabic-Indic ones (٨٬٠٠٠). Amounts stay
  // easy to compare with receipts, and the Gregorian calendar is kept (not Hijri).
  ar: { label: "العربية", dir: "rtl", intl: "ar-u-nu-latn", flag: "sa" },
  tr: { label: "Türkçe", dir: "ltr", intl: "tr", flag: "tr" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** First visit: guess from the browser's language, otherwise English. */
export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const code = navigator.language.slice(0, 2).toLowerCase();
  return isLocale(code) ? code : DEFAULT_LOCALE;
}
