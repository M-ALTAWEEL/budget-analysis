"use client";

import { ArrowLeft } from "lucide-react";
import { AnimatePresence } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { CategoryBreakdown } from "@/components/expense/CategoryBreakdown";
import { useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { ExpenseRow } from "@/components/expense/ExpenseRow";
import { MonthSwitcher, useMonth } from "@/components/layout/MonthProvider";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useCategories, useExpenses, useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { categoryShares, shareLabel } from "@/lib/insights";
import type { BudgetSummary, Category, Expense } from "@/types/api";

export default function ExpensesPage() {
  // useSearchParams needs a Suspense boundary (the page is rendered ahead of time).
  return (
    <Suspense fallback={<PageLoader />}>
      <Expenses />
    </Suspense>
  );
}

/** All of the month's expenses, or one category's (?category=uuid, from a tile). */
function Expenses() {
  const { month } = useMonth();
  const expenses = useExpenses(month);
  const summary = useSummary(month);
  const categories = useCategories();
  const openSheet = useExpenseSheet();
  const categoryUuid = useSearchParams().get("category");
  const currency = summary.data?.currency;
  const { t, monthName } = useI18n();
  const errorMessage = useErrorMessage();

  const category =
    categoryUuid === null
      ? null
      : (categories.data?.find((c) => c.uuid === categoryUuid) ??
        expenses.data?.find((e) => e.category.uuid === categoryUuid)?.category ??
        null);
  const shown: Expense[] =
    expenses.data?.filter((e) => categoryUuid === null || e.category.uuid === categoryUuid) ?? [];

  return (
    <>
      <header className="mb-10">
        <MonthSwitcher />
      </header>

      {categoryUuid !== null && (
        <CategoryHeader category={category} uuid={categoryUuid} summary={summary.data} />
      )}

      {expenses.isPending ? (
        <PageLoader />
      ) : expenses.isError ? (
        <LoadError message={errorMessage(expenses.error)} onRetry={() => expenses.refetch()} />
      ) : expenses.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-10">
          <p className="font-display text-xl font-semibold">{t.expenses.empty(monthName(month))}</p>
          <p className="mt-1 text-[15px] text-muted">{t.expenses.emptyHint}</p>
          <Button className="mt-5" onClick={() => openSheet()}>
            {t.expenses.addFirst}
          </Button>
        </div>
      ) : (
        <>
          {categoryUuid === null && summary.data && <CategoryBreakdown summary={summary.data} />}
          {shown.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-6 py-8 text-muted">
              {t.expenses.categoryEmpty}
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
              <AnimatePresence initial={false}>
                {shown.map((expense) => (
                  <ExpenseRow key={expense.uuid} expense={expense} budgetCurrency={currency} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </>
      )}
    </>
  );
}

/** One category's month: a way back, then how much went on it. */
function CategoryHeader({
  category,
  uuid,
  summary,
}: {
  category: Category | null;
  uuid: string;
  summary?: BudgetSummary | null;
}) {
  const { t, money, percent, monthName, categoryName } = useI18n();
  const { month } = useMonth();
  const share = summary ? categoryShares(summary).find((s) => s.category.uuid === uuid) : undefined;
  const name = category ? categoryName(category) : "";

  return (
    <section className="mb-8">
      <Link
        href="/expenses"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t.expenses.allExpenses}
      </Link>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-7 text-center">
        {category && <CategoryIcon category={category} />}
        <h1 className="text-muted">{t.expenses.categoryTotal(name, monthName(month))}</h1>
        {summary && (
          <p className="tabular font-display text-3xl font-semibold">
            {money(share?.spent ?? 0, summary.currency)}
          </p>
        )}
        {share && <p className="text-sm text-muted">{t.expenses.ofMonth(shareLabel(share.share, percent))}</p>}
      </div>
    </section>
  );
}
