import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { formatMoney } from "@/lib/money";
import type { BudgetSummary } from "@/types/api";

export function CategoryBreakdown({ summary }: { summary: BudgetSummary }) {
  if (summary.categories.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-5 py-6 text-[15px] text-muted">
        Nothing spent yet this month. Each expense you add shows up here under its category.
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
                <span className="truncate font-semibold">{category.name}</span>
                <span className="tabular shrink-0 text-[15px]">
                  {formatMoney(spent, summary.currency)}
                  {limit !== null && (
                    <span className="text-muted"> of {formatMoney(limit, summary.currency)}</span>
                  )}
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
                        ? `${formatMoney(Number(spent) - limit, summary.currency)} over the limit`
                        : `Only ${formatMoney(limit - Number(spent), summary.currency)} left`}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-0.5 text-sm text-muted">No limit set</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
