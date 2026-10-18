"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_LOCALE,
  LOCALE_INFO,
  LOCALE_STORAGE_KEY,
  detectLocale,
  isLocale,
  type Locale,
} from "@/i18n/config";
import { ar } from "@/i18n/messages/ar";
import { en, type Messages } from "@/i18n/messages/en";
import { tr } from "@/i18n/messages/tr";
import { formatMoney } from "@/lib/money";
import { dayLabel, monthLabel, monthName } from "@/lib/month";
import type { Category, Currency } from "@/types/api";

const MESSAGES: Record<Locale, Messages> = { en, ar, tr };

interface I18nValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: Messages;
  setLocale: (locale: Locale) => void;
  // Formatting that follows the language: "TRY 8,000" / "8.000 TRY", "October" / "أكتوبر" / "Ekim".
  money: (value: string | number, currency: Currency) => string;
  monthName: (month: string) => string;
  monthLabel: (month: string) => string;
  dayLabel: (isoDate: string) => string;
  /** Built-in categories are translated; the student's own ones keep the name they typed. */
  categoryName: (category: Category) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function readSavedLocale(): Locale | null {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(saved) ? saved : null;
  } catch {
    return null; // storage can be blocked (private mode, strict settings)
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // The server cannot know the browser's language, so the first render is always the
  // default; the saved choice is applied right after. (The script in layout.tsx has
  // already set lang/dir before the first paint, so the page does not jump.)
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only value
    setLocaleState(readSavedLocale() ?? detectLocale());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return; // do not overwrite what the early script set with the default
    const root = document.documentElement;
    root.lang = locale;
    root.dir = LOCALE_INFO[locale].dir;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // not saved, still works for this visit
    }
  }, [locale, ready]);

  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);

  const value = useMemo<I18nValue>(() => {
    const t = MESSAGES[locale];
    const intl = LOCALE_INFO[locale].intl;
    return {
      locale,
      dir: LOCALE_INFO[locale].dir,
      t,
      setLocale,
      money: (amount, currency) => formatMoney(amount, currency, intl),
      monthName: (month) => monthName(month, intl),
      monthLabel: (month) => monthLabel(month, intl),
      dayLabel: (isoDate) =>
        dayLabel(isoDate, intl, { today: t.expenses.today, yesterday: t.expenses.yesterday }),
      categoryName: (category) =>
        (category.is_default && category.slug && t.categories.names[category.slug]) || category.name,
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside <I18nProvider>");
  return context;
}
