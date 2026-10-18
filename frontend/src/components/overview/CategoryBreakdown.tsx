"use client";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useI18n } from "@/i18n/I18nProvider";
import type { BudgetSummary } from "@/types/api";

export function CategoryBreakdown({ summary }: { summary: BudgetSummary }) {
  const { t, money, categoryName } = useI18n();
  const formatMoney = (amount: string | number) => money(amount, summary.currency);

  if (summary.categories.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-5 py-6 text-[15px] text-muted">
        {t.overview.nothingSpent}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {summary.categories.map(({ category, limit_amount, spent }) => {
        const limit = limit_amount === null ? null : Number(limit_amount);
        const ratio = limit ? Number(spent) / limit : null;
        const barColor =
          ratio === null ? "" : ratio > 1 ? "bg-berry" : ratio > 0.85 ? "bg-marigold" : "bg-pine";
        return (
          <li key={category.uuid} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
            <CategoryIcon category={category} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-semibold">{categoryName(category)}</span>
                <span className="tabular shrink-0 text-[15px]">
                  {formatMoney(spent)}
                  {limit !== null && <span className="text-muted"> {t.tank.of(formatMoney(limit))}</span>}
                </span>
              </div>
              {ratio !== null && limit !== null ? (
                <>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-pine-soft">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${Math.min(ratio, 1) * 100}%` }}
                    />
                  </div>
                  {/* Say it in words too: colour alone is missed by colour-blind people. */}
                  {ratio > 0.85 && (
                    <p className={`mt-1 text-sm ${ratio > 1 ? "font-medium text-berry" : "text-muted"}`}>
                      {ratio > 1
                        ? t.overview.overLimit(formatMoney(Number(spent) - limit))
                        : t.overview.onlyLeft(formatMoney(limit - Number(spent)))}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-0.5 text-sm text-muted">{t.overview.noLimitSet}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
