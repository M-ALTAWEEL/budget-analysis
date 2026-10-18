"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useI18n } from "@/i18n/I18nProvider";
import { relativeChange, type MonthComparison } from "@/lib/insights";
import { shiftMonth } from "@/lib/month";
import type { Currency } from "@/types/api";

const SAME = 0.05; // within ±5% reads as "about the same"
const MAX_ROWS = 5;

/** One sentence + arrow for a change. Spending less is the good direction. */
function Change({ now, before }: { now: number; before: number }) {
  const { t, percent } = useI18n();
  const change = relativeChange(now, before);
  if (change === null) return <span className="text-sm text-muted">{t.insights.newThisMonth}</span>;
  if (Math.abs(change) < SAME)
    return (
      <span className="inline-flex items-center gap-1 text-sm text-muted">
        <Minus className="size-4" aria-hidden />
        {t.insights.same}
      </span>
    );
  const up = change > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${up ? "text-berry" : "text-pine"}`}>
      <Icon className="size-4 rtl:-scale-x-100" aria-hidden />
      {up ? t.insights.more(percent(change)) : t.insights.less(percent(-change))}
    </span>
  );
}

/**
 * This month so far vs the same days of last month. Two thin bars per category:
 * this month in pine (the story), last month in grey (context).
 */
export function MonthCompare({
  comparison,
  month,
  currency,
}: {
  comparison: MonthComparison;
  month: string;
  currency: Currency;
}) {
  const { t, money, monthName, categoryName } = useI18n();
  const format = (amount: number) => money(amount, currency);
  const rows = comparison.categories.slice(0, MAX_ROWS);
  const scale = Math.max(...rows.flatMap((row) => [row.now, row.before]), 1);
  const previousName = monthName(shiftMonth(month, -1));

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm text-muted">{t.insights.compareIntro(comparison.throughDay)}</p>

      {/* the headline: two numbers and the change between them */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted">{monthName(month)}</p>
          <p className="font-display text-2xl font-semibold">{format(comparison.now)}</p>
        </div>
        <div>
          <p className="text-sm text-muted">{t.insights.sameDays(previousName)}</p>
          <p className="font-display text-2xl font-semibold text-muted">{format(comparison.before)}</p>
        </div>
      </div>
      <div className="mt-2">
        <Change now={comparison.now} before={comparison.before} />
      </div>

      {rows.length > 0 && (
        <>
          <div className="mt-6 mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-3 rounded-sm bg-pine" aria-hidden />
              {monthName(month)}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-3 rounded-sm bg-muted/40" aria-hidden />
              {t.insights.sameDays(previousName)}
            </span>
          </div>
          <ul className="space-y-4">
            {rows.map(({ category, now, before }) => (
              <li key={category.uuid} className="flex items-start gap-3">
                <CategoryIcon category={category} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-semibold">{categoryName(category)}</span>
                    <Change now={now} before={before} />
                  </div>
                  {/* thin bars from the start edge, 2px apart, rounded at the data end only */}
                  <div className="mt-2 space-y-0.5">
                    <Bar value={now} scale={scale} className="bg-pine" label={format(now)} />
                    <Bar value={before} scale={scale} className="bg-muted/40" label={format(before)} muted />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Bar({
  value,
  scale,
  className,
  label,
  muted,
}: {
  value: number;
  scale: number;
  className: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1">
        {value > 0 && (
          <div
            className={`h-full rounded-e-[4px] ${className}`}
            style={{ width: `${Math.max((value / scale) * 100, 1)}%` }}
          />
        )}
      </div>
      <span className={`tabular w-24 shrink-0 text-end text-xs ${muted ? "text-muted" : ""}`}>{label}</span>
    </div>
  );
}
