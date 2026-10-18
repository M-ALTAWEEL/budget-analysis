"use client";

import { AllocationEditor, TotalForm } from "@/components/budget/BudgetPlan";
import { MonthSwitcher, useMonth } from "@/components/layout/MonthProvider";
import { BudgetSetup } from "@/components/overview/BudgetSetup";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useCategories, useSummary } from "@/hooks/queries";
import { errorMessage } from "@/lib/errors";

export default function BudgetPage() {
  const { month } = useMonth();
  const summary = useSummary(month);
  const categories = useCategories();

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
            <h2 id="limits" className="font-display text-xl font-semibold">
              Category limits
            </h2>
            <p className="mt-1 mb-4 text-[15px] text-muted">
              Decide how much each category may use this month. The overview warns you as a category
              gets close to its limit.
            </p>
            <AllocationEditor key={month} summary={summary.data} month={month} categories={categories.data} />
          </section>
        </div>
      )}
    </>
  );
}
