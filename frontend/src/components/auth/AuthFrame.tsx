"use client";

import Link from "next/link";

import { SampleTank } from "@/components/overview/BudgetTank";
import { LanguageMenu } from "@/components/settings/LanguageMenu";
import { ThemeButton } from "@/components/settings/ThemeButton";
import { useI18n } from "@/i18n/I18nProvider";

/** Split screen for login/register: the form, and a sample tank explaining the idea. */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="font-display text-xl font-bold tracking-tight" dir="ltr">
            BudgetBuddy
          </Link>
          <div className="flex items-center gap-2">
            <LanguageMenu />
            <ThemeButton />
          </div>
        </div>
        <div className="my-auto w-full max-w-sm py-12">{children}</div>
      </div>
      <aside className="hidden flex-col justify-center bg-panel px-16 text-white lg:flex">
        <p className="max-w-md font-display text-4xl leading-tight font-semibold">{t.auth.tagline}</p>
        <div className="mt-12 max-w-md">
          <SampleTank />
        </div>
      </aside>
    </div>
  );
}
