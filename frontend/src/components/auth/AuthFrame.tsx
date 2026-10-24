"use client";

import Link from "next/link";

import { useAuth } from "@/components/auth/AuthProvider";
import { TwoFactorStep } from "@/components/auth/TwoFactorStep";
import { SampleTank } from "@/components/overview/BudgetTank";
import { LanguageMenu } from "@/components/settings/LanguageMenu";
import { ThemeButton } from "@/components/settings/ThemeButton";
import { Logo } from "@/components/ui/Logo";
import { useI18n } from "@/i18n/I18nProvider";

/** Split screen for login/register: the form, and a sample tank explaining the idea. */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  // Password (or Google) was right and 2FA is on: the code step replaces the form.
  const { twoFactorChallenge } = useAuth();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" aria-label="Budget Analysis">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageMenu />
            <ThemeButton />
          </div>
        </div>
        <div className="my-auto w-full max-w-sm py-12">
          {twoFactorChallenge ? <TwoFactorStep /> : children}
        </div>
      </div>
      <aside className="relative isolate hidden flex-col justify-center overflow-hidden px-16 text-white lg:flex">
        {/* The landing picture, under the accent colour: white text stays readable. */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-[url(/hero.webp)] bg-cover bg-center" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-panel/90" />
        <p className="max-w-md font-display text-4xl leading-tight font-semibold">{t.auth.tagline}</p>
        <div className="mt-12 max-w-md">
          <SampleTank />
        </div>
      </aside>
    </div>
  );
}
