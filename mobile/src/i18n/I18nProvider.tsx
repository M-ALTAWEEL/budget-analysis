/**
 * Languages, the app's way: the same interface and texts as the website's I18nProvider
 * (the messages are shared), but the choice is kept on the phone, and before signing in
 * it follows the phone's language.
 */
import * as SecureStore from "expo-secure-store";
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { DEFAULT_LOCALE, LOCALE_INFO, isLocale, type Locale } from "@/i18n/config";
import { ar } from "@/i18n/messages/ar";
import { en, type Messages } from "@/i18n/messages/en";
import { tr } from "@/i18n/messages/tr";
import { formatMoney } from "@/lib/money";
import { dayLabel, monthLabel, monthName } from "@/lib/month";
import type { Category, Currency } from "@/types/api";

const MESSAGES: Record<Locale, Messages> = { en, ar, tr };
const KEY = "bb.locale";

interface I18nValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: Messages;
  setLocale: (locale: Locale) => void;
  money: (value: string | number, currency: Currency) => string;
  monthName: (month: string) => string;
  monthLabel: (month: string) => string;
  dayLabel: (isoDate: string) => string;
  shortDate: (isoDate: string) => string;
  percent: (ratio: number) => string;
  compact: (value: number) => string;
  categoryName: (category: Category) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function phoneLocale(): Locale {
  const code = Intl.DateTimeFormat().resolvedOptions().locale.slice(0, 2).toLowerCase();
  return isLocale(code) ? code : DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(phoneLocale);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((saved) => {
        if (isLocale(saved)) setLocaleState(saved);
      })
      .catch(() => undefined);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    SecureStore.setItemAsync(KEY, next).catch(() => undefined);
  }, []);

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
      shortDate: (isoDate) => {
        const [year, month, day] = isoDate.split("-").map(Number);
        return new Intl.DateTimeFormat(intl, { day: "numeric", month: "short" }).format(
          new Date(year, month - 1, day),
        );
      },
      percent: (ratio) =>
        new Intl.NumberFormat(intl, { style: "percent", maximumFractionDigits: 0 }).format(ratio),
      compact: (value) =>
        new Intl.NumberFormat(intl, { notation: "compact", maximumFractionDigits: 1 }).format(value),
      categoryName: (category) =>
        (category.is_default && category.slug && t.categories.names[category.slug]) || category.name,
    };
  }, [locale, setLocale]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
  const context = use(I18nContext);
  if (!context) throw new Error("useI18n must be used inside <I18nProvider>");
  return context;
}
