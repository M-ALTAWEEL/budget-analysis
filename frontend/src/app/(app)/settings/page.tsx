"use client";

import { LogOut, Monitor, Moon, Sun } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { useChangeLocale } from "@/components/settings/useChangeLocale";
import { Button } from "@/components/ui/Button";
import { Flag } from "@/components/ui/Flag";
import { LOCALES, LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme, type ThemePreference } from "@/theme/ThemeProvider";

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
  const { preference, setPreference } = useTheme();
  const { user, logout } = useAuth();

  return (
    <>
      <h1 className="mb-10 font-display text-2xl font-semibold">{t.settings.title}</h1>

      <div className="space-y-10">
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

        <section aria-labelledby="account">
          <h2 id="account" className="mb-3 font-display text-lg font-semibold">
            {t.settings.account}
          </h2>
          <div className="rounded-2xl border border-line bg-surface px-5 py-4">
            <p className="font-semibold">{user?.full_name}</p>
            <p className="text-sm text-muted" dir="ltr">
              {user?.email}
            </p>
            <Button variant="secondary" className="mt-4" onClick={logout}>
              <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
              {t.nav.logout}
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
