"use client";

import { AnimatePresence } from "motion/react";
import Link from "next/link";

import { PendingSharesBanner } from "@/components/groups/PendingShares";
import { PendingExpenses } from "@/components/offline/Offline";
import { ExpenseRow } from "@/components/expense/ExpenseRow";
import { AlertList } from "@/components/insights/AlertList";
import { PaceChart } from "@/components/insights/PaceChart";
import { SpendingYear } from "@/components/insights/SpendingYear";
import { TipList } from "@/components/insights/TipList";
import { MonthSwitcher, useMonth } from "@/components/layout/MonthProvider";
import { BudgetSetup } from "@/components/overview/BudgetSetup";
import { BudgetRing } from "@/components/overview/BudgetRing";
import { BudgetTank, budgetPace } from "@/components/overview/BudgetTank";
import { CategoryBreakdown } from "@/components/overview/CategoryBreakdown";
import { GoalsCard } from "@/components/overview/GoalsCard";
import { QuickAdd } from "@/components/overview/QuickAdd";
import { Card, CardHeader } from "@/components/ui/Card";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useDaily, useExpenses, useSummary, useTips, useWrapped } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { findAlerts } from "@/lib/insights";
import { currentMonth, monthProgress, shiftMonth } from "@/lib/month";
import type { BudgetSummary, DailySpending, Expense, Tips } from "@/types/api";

/** The Overview as a grid of cards: one column on phones, two on tablets, four on wide screens. */
export default function OverviewPage() {
  const { month } = useMonth();
  const summary = useSummary(month);
  const expenses = useExpenses(month);
  const daily = useDaily(month);
  const tips = useTips(month);
  const errorMessage = useErrorMessage();

  return (
    <>
      <header className="mb-6">
        <MonthSwitcher />
      </header>

      <PendingSharesBanner />
      <PendingExpenses />
      {month === currentMonth() && <WrappedBanner />}

      {summary.isPending ? (
        <PageLoader />
      ) : summary.isError ? (
        <LoadError message={errorMessage(summary.error)} onRetry={() => summary.refetch()} />
      ) : summary.data === null ? (
        <BudgetSetup month={month} />
      ) : (
        <Bento
          summary={summary.data}
          month={month}
          daily={daily.data}
          tips={tips.data}
          expenses={expenses.data}
        />
      )}
    </>
  );
}

function Bento({
  summary,
  month,
  daily,
  tips,
  expenses,
}: {
  summary: BudgetSummary;
  month: string;
  daily: DailySpending | null | undefined;
  tips: Tips | null | undefined;
  expenses: Expense[] | undefined;
}) {
  const { t } = useI18n();
  const pace = budgetPace(summary, month, daily?.forecast);
  const alerts = findAlerts(summary, month);
  const hasTips = tips && (tips.repeated.length > 0 || tips.busiest_weekday);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Hero>
        <BudgetTank summary={summary} month={month} forecast={daily?.forecast} inverse />
      </Hero>
      <BudgetRing summary={summary} month={month} pace={pace} />
      <QuickAdd />

      {alerts.length > 0 && (
        <div className="md:col-span-2 xl:col-span-4">
          <AlertList alerts={alerts} currency={summary.currency} />
        </div>
      )}

      {daily && (
        <Card aria-labelledby="pace" className={hasTips ? "md:col-span-2" : "md:col-span-2 xl:col-span-4"}>
          <CardHeader id="pace" title={t.insights.paceTitle} />
          <p className="-mt-1.5 max-w-prose text-sm text-muted">{t.insights.paceIntro}</p>
          <PaceChart daily={daily} month={month} />
        </Card>
      )}

      {tips && hasTips && (
        <Card aria-labelledby="tips" className={daily ? "md:col-span-2" : "md:col-span-2 xl:col-span-4"}>
          <CardHeader id="tips" title={t.insights.tipsTitle} />
          <TipList tips={tips} plain />
        </Card>
      )}

      <Card aria-labelledby="year" className="md:col-span-2 xl:col-span-4">
        <CardHeader id="year" title={t.skyline.title} />
        <SpendingYear month={month} />
      </Card>

      <Card aria-labelledby="by-category" className="md:col-span-2">
        <CardHeader
          id="by-category"
          title={t.overview.whereItWent}
          action={
            <Link href="/budget" className="text-sm font-semibold text-brand hover:underline">
              {t.overview.planCategories}
            </Link>
          }
        />
        <CategoryBreakdown summary={summary} plain />
      </Card>

      {expenses && expenses.length > 0 && (
        <Card aria-labelledby="recent" className="md:col-span-2">
          <CardHeader
            id="recent"
            title={t.overview.latest}
            action={
              <Link href="/expenses" className="text-sm font-semibold text-brand hover:underline">
                {t.overview.seeAll}
              </Link>
            }
          />
          <ul className="-mx-5 -mb-2 divide-y divide-line">
            <AnimatePresence initial={false}>
              {expenses.slice(0, 5).map((expense) => (
                <ExpenseRow key={expense.uuid} expense={expense} budgetCurrency={summary.currency} />
              ))}
            </AnimatePresence>
          </ul>
        </Card>
      )}

      <GoalsCard />
    </div>
  );
}

/**
 * The first card: what is left, on the brand panel. Behind the number, the logo's three bars
 * and coin, ghosted (decoration only).
 */
function Hero({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-card bg-panel p-6 text-white shadow-[0_24px_48px_-24px_color-mix(in_srgb,var(--color-panel)_70%,transparent)] md:col-span-2">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_150%_at_100%_0%,rgb(255_255_255/0.16)_0%,transparent_55%)] rtl:bg-[radial-gradient(120%_150%_at_0%_0%,rgb(255_255_255/0.16)_0%,transparent_55%)]"
      />
      <span aria-hidden className="pointer-events-none absolute end-6 -bottom-5 flex items-end gap-3">
        <i className="block h-[92px] w-[46px] rounded-full bg-white/10" />
        <i className="block h-[138px] w-[46px] rounded-full bg-white/10" />
        <i className="relative block h-[184px] w-[46px] rounded-full bg-white/10">
          <i className="absolute -top-10 start-[11px] block size-6 rounded-full bg-coral/80" />
        </i>
      </span>
      <div className="relative">{children}</div>
    </section>
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
      className="mb-5 flex items-center justify-between gap-3 rounded-card bg-brand px-5 py-4 text-on-brand transition-opacity hover:opacity-90"
    >
      <span className="font-semibold">{t.wrapped.ready(monthLabel(previous))}</span>
      <span className="shrink-0 text-sm font-semibold underline">{t.wrapped.see}</span>
    </Link>
  );
}
