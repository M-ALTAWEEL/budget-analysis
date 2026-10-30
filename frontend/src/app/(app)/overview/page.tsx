"use client";

import { AnimatePresence } from "motion/react";
import Link from "next/link";

import { PendingSharesBanner } from "@/components/groups/PendingShares";
import { useCurrentUser } from "@/components/auth/AuthProvider";
import { ExpenseRow } from "@/components/expense/ExpenseRow";
import { AlertList } from "@/components/insights/AlertList";
import { MonthCompare } from "@/components/insights/MonthCompare";
import { PaceChart } from "@/components/insights/PaceChart";
import { TipList } from "@/components/insights/TipList";
import { MonthSwitcher, useMonth } from "@/components/layout/MonthProvider";
import { BudgetSetup } from "@/components/overview/BudgetSetup";
import { BudgetTank } from "@/components/overview/BudgetTank";
import { CategoryBreakdown } from "@/components/overview/CategoryBreakdown";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useDaily, useExpenses, useSummary, useTips, useWrapped } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { compareWithPrevious, daysElapsed, findAlerts } from "@/lib/insights";
import { currentMonth, monthProgress, shiftMonth } from "@/lib/month";
import type { DailySpending } from "@/types/api";

/** A titled block of the overview. */
function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14" aria-labelledby={id}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-display text-xl font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function OverviewPage() {
  const { month } = useMonth();
  const summary = useSummary(month);
  const expenses = useExpenses(month);
  const daily = useDaily(month);
  const previousDaily = useDaily(shiftMonth(month, -1));
  const tips = useTips(month);
  const user = useCurrentUser();
  const { t } = useI18n();
  const hour = new Date().getHours();
  const firstName = user.full_name.split(" ")[0];
  const greeting =
    hour < 12 ? t.overview.morning(firstName) : hour < 18 ? t.overview.afternoon(firstName) : t.overview.evening(firstName);
  const errorMessage = useErrorMessage();

  return (
    <>
      <header className="mb-10">
        <p className="mb-1 text-[15px] text-muted">{greeting}</p>
        <MonthSwitcher />
      </header>

      <PendingSharesBanner />
      {month === currentMonth() && <WrappedBanner />}

      {summary.isPending ? (
        <PageLoader />
      ) : summary.isError ? (
        <LoadError message={errorMessage(summary.error)} onRetry={() => summary.refetch()} />
      ) : summary.data === null ? (
        <BudgetSetup month={month} />
      ) : (
        <>
          <BudgetTank summary={summary.data} month={month} forecast={daily.data?.forecast} />

          <AlertList alerts={findAlerts(summary.data, month)} currency={summary.data.currency} />

          {daily.data && (
            <Section id="pace" title={t.insights.paceTitle}>
              <p className="-mt-2 mb-4 max-w-prose text-[15px] text-muted">{t.insights.paceIntro}</p>
              <PaceChart daily={daily.data} month={month} />
            </Section>
          )}

          {tips.data && (tips.data.repeated.length > 0 || tips.data.busiest_weekday) && (
            <Section id="tips" title={t.insights.tipsTitle}>
              <TipList tips={tips.data} />
            </Section>
          )}

          {/* nothing to compare before the month has started */}
          {daily.data && previousDaily.isSuccess && daysElapsed(month) > 0 && (
            <Section id="compare" title={t.insights.compareTitle}>
              <Comparison current={daily.data} previous={previousDaily.data} month={month} />
            </Section>
          )}

          <Section
            id="by-category"
            title={t.overview.whereItWent}
            action={
              <Link href="/budget" className="text-sm font-semibold text-pine hover:underline">
                {t.overview.planCategories}
              </Link>
            }
          >
            <CategoryBreakdown summary={summary.data} />
          </Section>

          {expenses.data && expenses.data.length > 0 && (
            <Section
              id="recent"
              title={t.overview.latest}
              action={
                <Link href="/expenses" className="text-sm font-semibold text-pine hover:underline">
                  {t.overview.seeAll}
                </Link>
              }
            >
              <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
                <AnimatePresence initial={false}>
                  {expenses.data.slice(0, 5).map((expense) => (
                    <ExpenseRow key={expense.uuid} expense={expense} budgetCurrency={summary.data?.currency} />
                  ))}
                </AnimatePresence>
              </ul>
            </Section>
          )}
        </>
      )}
    </>
  );
}

/** The comparison, or one honest sentence about why there isn't one. */
function Comparison({
  current,
  previous,
  month,
}: {
  current: DailySpending;
  previous: DailySpending | null;
  month: string;
}) {
  const { t } = useI18n();
  const comparison = compareWithPrevious(current, previous, month);
  if (comparison) return <MonthCompare comparison={comparison} month={month} currency={current.currency} />;

  const reason =
    previous && previous.currency !== current.currency ? t.insights.differentCurrency : t.insights.noComparison;
  return (
    <p className="rounded-2xl border border-dashed border-line px-5 py-6 text-[15px] text-muted">{reason}</p>
  );
}

/** In the first week of a month: last month's report is ready (feature F4). */
function WrappedBanner() {
  const { t, monthLabel } = useI18n();
  const previous = shiftMonth(currentMonth(), -1);
  const early = monthProgress(currentMonth()).dayOfMonth <= 7;
  const report = useWrapped(previous, early);
  if (!early || !report.data) return null;
  return (
    <Link
      href={`/wrapped?month=${previous}`}
      className="mb-8 flex items-center justify-between gap-3 rounded-2xl bg-pine px-5 py-4 text-white transition-opacity hover:opacity-90"
    >
      <span className="font-semibold">{t.wrapped.ready(monthLabel(previous))}</span>
      <span className="shrink-0 text-sm font-semibold underline">{t.wrapped.see}</span>
    </Link>
  );
}
