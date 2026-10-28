"use client";

import Link from "next/link";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useI18n } from "@/i18n/I18nProvider";
import { categoryShares, shareLabel } from "@/lib/insights";
import type { BudgetSummary } from "@/types/api";

/** Where the month's money went: one bar split by category, then a tile per category. */
export function CategoryBreakdown({ summary }: { summary: BudgetSummary }) {
  const { t, money, percent, categoryName } = useI18n();
  const shares = categoryShares(summary);
  if (shares.length === 0) return null;

  return (
    <section aria-labelledby="by-category" className="mb-8 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 id="by-category" className="mb-4 font-semibold">
        {t.expenses.byCategory}
      </h2>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {shares.map(({ category, share }) => (
          <span key={category.uuid} style={{ width: `${share * 100}%`, backgroundColor: category.color }} />
        ))}
      </div>
      <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {shares.map(({ category, spent, share }) => (
          <li key={category.uuid}>
            <Link
              href={`/expenses?category=${category.uuid}`}
              className="flex h-full flex-col items-center gap-2 rounded-xl border border-line px-2 py-3 text-center transition-colors hover:bg-ink/[0.03]"
            >
              <span className="w-full truncate text-sm text-muted">{categoryName(category)}</span>
              <CategoryIcon category={category} />
              <span className="tabular text-lg font-semibold">{shareLabel(share, percent)}</span>
              <span className="sr-only">{money(spent, summary.currency)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
