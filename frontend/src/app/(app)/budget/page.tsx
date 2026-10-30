"use client";

import { ChevronRight, Sparkles, Wallet } from "lucide-react";
import Link from "next/link";

import { AllocationEditor, TotalForm } from "@/components/budget/BudgetPlan";
import { MonthSwitcher, useMonth } from "@/components/layout/MonthProvider";
import { BudgetSetup } from "@/components/overview/BudgetSetup";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useCategories, useIncome, useSummary } from "@/hooks/queries";
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
      <IncomeLink month={month} />
      <WrappedLink month={month} />

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

/** The way to the month's income (feature F3), with what came in. */
function IncomeLink({ month }: { month: string }) {
  const income = useIncome(month);
  const { t, money } = useI18n();
  const data = income.data;
  const label =
    data && data.items.length > 0 ? t.income.summary(money(data.total, data.currency)) : t.income.title;
  return (
    <Link
      href="/income"
      className="mb-3 flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4 transition-colors hover:bg-ink/[0.03]"
    >
      <Wallet className="size-5 shrink-0 text-pine" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-semibold">{label}</span>
      <ChevronRight className="size-5 shrink-0 text-muted rtl:-scale-x-100" aria-hidden />
    </Link>
  );
}

/** The way to the month report (feature F4). */
function WrappedLink({ month }: { month: string }) {
  const { t } = useI18n();
  return (
    <Link
      href={`/wrapped?month=${month}`}
      className="mb-10 flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4 transition-colors hover:bg-ink/[0.03]"
    >
      <Sparkles className="size-5 shrink-0 text-pine" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-semibold">{t.wrapped.title}</span>
      <ChevronRight className="size-5 shrink-0 text-muted rtl:-scale-x-100" aria-hidden />
    </Link>
  );
}
