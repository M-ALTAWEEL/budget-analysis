"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, LifeBuoy, LogOut, Monitor, Moon, Shapes, Sun } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { AccountActions } from "@/components/settings/AccountActions";
import { BudgetCycleSection } from "@/components/settings/BudgetCycleSection";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { useChangeLocale } from "@/components/settings/useChangeLocale";
import { Button } from "@/components/ui/Button";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { Flag } from "@/components/ui/Flag";
import { LOCALES, LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { updateMe } from "@/services/auth";
import { useSupport } from "@/hooks/queries";
import { getVersion } from "@/services/system";
import { ACCENTS, useTheme, type ThemePreference } from "@/theme/ThemeProvider";
import type { Currency } from "@/types/api";

/** A row of large, tappable options where exactly one is chosen (a radio group). */
function Choice({
  selected,
  onSelect,
  children,
  lang,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  lang?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      lang={lang}
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-start text-[15px] transition-colors ${
        selected ? "border-pine bg-pine-soft font-semibold ring-1 ring-pine" : "border-line bg-surface hover:border-ink/30"
      }`}
    >
      {children}
    </button>
  );
}

const THEMES: { value: ThemePreference; icon: typeof Sun }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const changeLocale = useChangeLocale();
  const { preference, setPreference, accent, setAccent } = useTheme();
  const { user, logout } = useAuth();

  return (
    <>
      <h1 className="mb-10 font-display text-2xl font-semibold">{t.settings.title}</h1>

      <div className="space-y-10">
        <ProfileSection />

        <section aria-labelledby="language">
          <h2 id="language" className="mb-3 font-display text-lg font-semibold">
            {t.settings.language}
          </h2>
          <div role="radiogroup" aria-labelledby="language" className="grid gap-2 sm:grid-cols-3">
            {LOCALES.map((code) => (
              <Choice key={code} lang={code} selected={code === locale} onSelect={() => void changeLocale(code)}>
                <Flag code={LOCALE_INFO[code].flag} className="h-4 w-6" />
                {LOCALE_INFO[code].label}
              </Choice>
            ))}
          </div>
        </section>

        <section aria-labelledby="appearance">
          <h2 id="appearance" className="mb-3 font-display text-lg font-semibold">
            {t.settings.appearance}
          </h2>
          <div role="radiogroup" aria-labelledby="appearance" className="grid gap-2 sm:grid-cols-3">
            {THEMES.map(({ value, icon: Icon }) => (
              <Choice key={value} selected={value === preference} onSelect={() => setPreference(value)}>
                <Icon className="size-5 text-muted" aria-hidden />
                {t.settings[value]}
              </Choice>
            ))}
          </div>
        </section>

        <section aria-labelledby="accent">
          <h2 id="accent" className="mb-3 font-display text-lg font-semibold">
            {t.settings.accent}
          </h2>
          <div role="radiogroup" aria-labelledby="accent" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ACCENTS.map((value) => (
              <Choice key={value} selected={value === accent} onSelect={() => setAccent(value)}>
                {/* The swatch shows the colour as it looks in the current theme */}
                <span className="size-5 shrink-0 rounded-full" data-accent-swatch={value} aria-hidden />
                {t.settings.accents[value]}
              </Choice>
            ))}
          </div>
        </section>

        <MainCurrency />

        <SecondCurrency />

        <BudgetCycleSection />

        <Link
          href="/categories"
          className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4 text-[15px] font-semibold hover:border-ink/30"
        >
          <Shapes className="size-5 text-muted" aria-hidden />
          <span className="flex-1">{t.settings.manageCategories}</span>
          <ChevronRight className="size-5 text-muted rtl:-scale-x-100" aria-hidden />
        </Link>

        <SupportLink />

        <section aria-labelledby="account">
          <h2 id="account" className="mb-3 font-display text-lg font-semibold">
            {t.settings.account}
          </h2>
          <div className="rounded-2xl border border-line bg-surface px-5 py-4">
            <p className="font-semibold">{user?.full_name}</p>
            <p className="text-sm text-muted" dir="ltr">
              {user?.username ? `@${user.username} · ` : ""}
              {user?.email ?? user?.phone}
            </p>
            <Button variant="secondary" className="mt-4" onClick={logout}>
              <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
              {t.nav.logout}
            </Button>
          </div>
        </section>

        <SecuritySection />

        <AccountActions />

        <Versions />
      </div>
    </>
  );
}

/** Which code runs on the website and on the server. If they ever stop matching after a
 *  release, one of the two did not deploy. */
function Versions() {
  const { t } = useI18n();
  const { data } = useQuery({ queryKey: ["version"], queryFn: getVersion, staleTime: 5 * 60_000 });
  return (
    <p className="text-xs text-muted" dir="ltr">
      {t.settings.version}: web {process.env.NEXT_PUBLIC_COMMIT} · api {data?.commit ?? "…"}
      {data && data.environment !== "production" && ` (${data.environment})`}
    </p>
  );
}

/** The currency of new budgets and expenses. Months already set up keep theirs. */
function MainCurrency() {
  const { t } = useI18n();
  const { user, updateUser } = useAuth();
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  async function change(value: Currency) {
    setError(null);
    try {
      // If the second currency was this one, clear it: showing TRY ≈ TRY says nothing.
      const clearSecond = user?.secondary_currency === value;
      updateUser(
        await updateMe({ base_currency: value, ...(clearSecond ? { secondary_currency: null } : {}) }),
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section aria-labelledby="main-currency">
      <h2 id="main-currency" className="mb-3 font-display text-lg font-semibold">
        {t.settings.mainCurrency}
      </h2>
      <CurrencySelect
        label={t.settings.mainCurrencyHint}
        value={user.base_currency}
        onChange={(code) => void change(code)}
      />
      {error && <p className="mt-2 text-sm text-berry">{error}</p>}
    </section>
  );
}

/** Show amounts also in a second currency (≈), saved on the account. */
function SecondCurrency() {
  const { t } = useI18n();
  const { user, updateUser } = useAuth();
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  async function change(value: string) {
    setError(null);
    try {
      updateUser(await updateMe({ secondary_currency: value === "" ? null : (value as Currency) }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section aria-labelledby="second-currency">
      <h2 id="second-currency" className="mb-3 font-display text-lg font-semibold">
        {t.settings.secondCurrency}
      </h2>
      <CurrencySelect
        label={t.settings.secondCurrencyHint}
        value={user.secondary_currency ?? ""}
        exclude={user.base_currency}
        onChange={(code) => void change(code)}
      >
        <option value="">{t.settings.none}</option>
      </CurrencySelect>
      {error && <p className="mt-2 text-sm text-berry">{error}</p>}
    </section>
  );
}

/** Help and feedback, with a dot when the team has answered. */
function SupportLink() {
  const { t } = useI18n();
  const tickets = useSupport();
  const unread = tickets.data?.filter((ticket) => ticket.unread).length ?? 0;
  return (
    <Link
      href="/support"
      className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4 text-[15px] hover:border-ink/30"
    >
      <LifeBuoy className="size-5 text-muted" aria-hidden />
      <span className="flex-1">
        <span className="block font-semibold">{t.support.link}</span>
        <span className="block text-sm text-muted">{t.support.linkHint}</span>
      </span>
      {unread > 0 && (
        <span className="grid size-6 place-items-center rounded-full bg-pine text-xs font-semibold text-white">{unread}</span>
      )}
      <ChevronRight className="size-5 text-muted rtl:-scale-x-100" aria-hidden />
    </Link>
  );
}
