"use client";

import { Moon, Sun } from "lucide-react";

import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";

/** One-tap light/dark switch for the sign-in screens. Settings has the full choice. */
export function ThemeButton() {
  const { resolved, setPreference } = useTheme();
  const { t } = useI18n();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={next === "dark" ? t.settings.dark : t.settings.light}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-muted hover:border-ink/30 hover:text-ink"
    >
      {resolved === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  );
}
