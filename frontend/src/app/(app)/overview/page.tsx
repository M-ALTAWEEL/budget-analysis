"use client";

import Link from "next/link";

import { ExpenseRow } from "@/components/expense/ExpenseRow";
import { MonthSwitcher, useMonth } from "@/components/layout/MonthProvider";
import { BudgetSetup } from "@/components/overview/BudgetSetup";
import { BudgetTank } from "@/components/overview/BudgetTank";
import { CategoryBreakdown } from "@/components/overview/CategoryBreakdown";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useExpenses, useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";

export default function OverviewPage() {
  const { month } = useMonth();
  const summary = useSummary(month);
  const expenses = useExpenses(month);
  const { t } = useI18n();
  const errorMessage = useErrorMessage();

  return (
    <>
      <header className="mb-10">
        <MonthSwitcher />
      </header>

      {summary.isPending ? (
        <PageLoader />
      ) : summary.isError ? (
        <LoadError message={errorMessage(summary.error)} onRetry={() => summary.refetch()} />
      ) : summary.data === null ? (
        <BudgetSetup month={month} />
      ) : (
        <>
          <BudgetTank summary={summary.data} month={month} />

          <section className="mt-14" aria-labelledby="by-category">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 id="by-category" className="font-display text-xl font-semibold">
                {t.overview.whereItWent}
              </h2>
              <Link href="/budget" className="text-sm font-semibold text-pine hover:underline">
                {t.overview.planCategories}
              </Link>
            </div>
            <CategoryBreakdown summary={summary.data} />
          </section>

          {expenses.data && expenses.data.length > 0 && (
            <section className="mt-14" aria-labelledby="recent">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 id="recent" className="font-display text-xl font-semibold">
                  {t.overview.latest}
                </h2>
                <Link href="/expenses" className="text-sm font-semibold text-pine hover:underline">
                  {t.overview.seeAll}
                </Link>
              </div>
              <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
                {expenses.data.slice(0, 5).map((expense) => (
                  <ExpenseRow key={expense.uuid} expense={expense} budgetCurrency={summary.data?.currency} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
