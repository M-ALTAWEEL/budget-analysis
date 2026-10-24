"use client";

import Link from "next/link";

import { LanguageMenu } from "@/components/settings/LanguageMenu";
import { ThemeButton } from "@/components/settings/ThemeButton";
import { Logo } from "@/components/ui/Logo";
import { useI18n } from "@/i18n/I18nProvider";
import type { Locale } from "@/i18n/config";

const REPO_ISSUES = "https://github.com/M-ALTAWEEL/budget-analysis/issues";
const LINKEDIN = "https://www.linkedin.com/in/mouhammed-altaweel";

export interface LegalDocument {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
  contact: string;
  back: string;
}

/** The privacy policy and the terms of use: same layout, in the reader's language. */
export function LegalPage({ documents }: { documents: Record<Locale, LegalDocument> }) {
  const { t, locale } = useI18n();
  const doc = documents[locale];
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-5 sm:px-8">
        <Link href="/" aria-label="Budget Analysis">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageMenu />
          <ThemeButton />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-8 pb-24 sm:px-8">
        <h1 className="font-display text-4xl font-semibold">{doc.title}</h1>
        <p className="mt-2 text-sm text-muted">{doc.updated}</p>
        <p className="mt-8 max-w-prose text-[17px] leading-relaxed">{doc.intro}</p>

        {doc.sections.map((section, index) => (
          <section key={section.heading} className="mt-10">
            <h2 className="font-display text-xl font-semibold">
              {index + 1}. {section.heading}
            </h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-3 max-w-prose text-[17px] leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold">{doc.contact}</h2>
          <ul className="mt-3 space-y-2 text-[17px]">
            <li>
              <a href={REPO_ISSUES} className="font-semibold text-pine hover:underline">
                GitHub
              </a>
            </li>
            <li>
              <a href={LINKEDIN} className="font-semibold text-pine hover:underline">
                LinkedIn
              </a>
            </li>
          </ul>
        </section>

        <div className="mt-14 flex flex-wrap gap-6">
          <Link href="/" className="font-semibold text-pine hover:underline">
            {doc.back}
          </Link>
          <Link href="/privacy" className="font-semibold text-pine hover:underline">
            {t.landing.privacy}
          </Link>
          <Link href="/terms" className="font-semibold text-pine hover:underline">
            {t.landing.terms}
          </Link>
        </div>
      </main>
    </div>
  );
}
