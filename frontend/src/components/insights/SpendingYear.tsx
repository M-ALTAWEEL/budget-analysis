"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useMemo } from "react";

import ContributionSkyline, { type SkylineLabels } from "@/components/ui/ContributionSkyline";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useSpendingYear } from "@/hooks/queries";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { todayISO } from "@/lib/month";
import { monthChange, skylineStats, spendingStats, yearOfSpending, type SkylineFormat } from "@/lib/skyline";

// Healthy → caution → overspent, the app's own colours: they follow light/dark and the accent.
const PALETTE = ["var(--color-pine-soft)", "var(--color-pine)", "var(--color-marigold)", "var(--color-berry)"];

/**
 * The Overview's "Your year of spending": one line comparing this month with the same days
 * of last month, then the last 12 months day by day (the skyline). The app draws the same
 * chart with SVG (mobile/src/components/insights/SpendingYear.tsx).
 */
export function SpendingYear({ month }: { month: string }) {
  const { t, locale, money, shortDate, percent } = useI18n();
  const errorMessage = useErrorMessage();
  const year = useSpendingYear(month);
  const current = year.dailies[11];
  const previous = year.dailies[10];
  const lastDay = current?.days[current.days.length - 1]?.day ?? todayISO();
  const through = lastDay < todayISO() ? lastDay : todayISO();
  const days = useMemo(
    () => (current ? yearOfSpending(year.dailies, current.currency, through) : []),
    [year.dailies, current, through],
  );

  if (year.isPending) return <PageLoader />;
  if (year.isError) return <LoadError message={errorMessage(year.error)} onRetry={year.refetch} />;
  if (!current) return null;

  const intl = LOCALE_INFO[locale].intl;
  const counter = new Intl.NumberFormat(intl);
  const format: SkylineFormat = {
    money: (amount) => money(amount, current.currency),
    date: shortDate,
    count: (value) => counter.format(value),
    percent,
  };
  const stats = spendingStats(days);
  const change = monthChange(current, previous, month, t, format);
  const Icon = change.direction === "up" ? ArrowUpRight : change.direction === "down" ? ArrowDownRight : Minus;
  const labels: SkylineLabels = {
    view: t.skyline.view,
    flat: t.skyline.flat,
    skyline: t.skyline.skyline,
    levels: t.skyline.levels,
    less: t.skyline.less,
    more: t.skyline.more,
    hintFlat: t.skyline.hintFlat,
    hintSkyline: t.skyline.hintSkyline,
    spentOn: t.skyline.spentOn,
    nothingOn: t.skyline.nothingOn,
    chartLabel: t.skyline.chartLabel,
  };

  return (
    <div>
      <p className="flex items-center gap-1.5 text-[17px] font-semibold">
        {change.direction && <Icon className="size-5 shrink-0" aria-hidden />}
        {change.text}
      </p>
      {change.note && <p className="mt-1 text-sm text-muted">{change.note}</p>}
      <p className="mt-4 mb-4 max-w-prose text-[15px] text-muted">{t.skyline.intro}</p>
      {stats.total > 0 ? (
        <ContributionSkyline
          data={days}
          endDate={through}
          palette={PALETTE}
          stats={skylineStats(stats, t, format)}
          labels={labels}
          formatValue={format.money}
          total={format.money(stats.total)}
          locale={intl}
        />
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-5 py-6 text-[15px] text-muted">{t.skyline.empty}</p>
      )}
    </div>
  );
}
