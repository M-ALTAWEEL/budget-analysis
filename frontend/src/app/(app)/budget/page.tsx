"use client";

import Link from "next/link";

import { AllocationEditor, TotalForm } from "@/components/budget/BudgetPlan";
import { MonthSwitcher, useMonth } from "@/components/layout/MonthProvider";
import { BudgetSetup } from "@/components/overview/BudgetSetup";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useCategories, useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";

export default function BudgetPage() {
  const { month } = useMonth();
  const summary = useSummary(month);
  const categories = useCategories();
  const { t } = useI18n();
  const errorMessage = useErrorMessage();

  return (
    <>
      <header className="mb-10">
        <MonthSwitcher />
      </header>

      {summary.isPending || categories.isPending ? (
        <PageLoader />
      ) : summary.isError || categories.isError ? (
        <LoadError
          message={errorMessage(summary.error ?? categories.error)}
          onRetry={() => {
            summary.refetch();
            categories.refetch();
          }}
        />
      ) : summary.data === null ? (
        <BudgetSetup month={month} />
      ) : (
        <div className="space-y-12">
          <section>
            {/* key: reset the form when the month or saved total changes */}
            <TotalForm key={`${month}-${summary.data.total_amount}`} summary={summary.data} month={month} />
          </section>
          <section aria-labelledby="limits">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="limits" className="font-display text-xl font-semibold">
                {t.budget.limitsTitle}
              </h2>
              <Link href="/categories" className="text-sm font-semibold text-pine hover:underline">
                {t.settings.manageCategories}
              </Link>
            </div>
            <p className="mt-1 mb-4 text-[15px] text-muted">
              {t.budget.limitsIntro}
            </p>
            <AllocationEditor key={month} summary={summary.data} month={month} categories={categories.data} />
          </section>
        </div>
      )}
    </>
  );
}
