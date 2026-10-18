"use client";

import { AnimatePresence } from "motion/react";

import { useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { ExpenseRow } from "@/components/expense/ExpenseRow";
import { MonthSwitcher, useMonth } from "@/components/layout/MonthProvider";
import { Button } from "@/components/ui/Button";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useExpenses, useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import type { Expense } from "@/types/api";

/** Expenses are already sorted newest first; group consecutive ones by day. */
function groupByDay(expenses: Expense[]) {
  const groups: { day: string; items: Expense[] }[] = [];
  for (const expense of expenses) {
    const last = groups.at(-1);
    if (last?.day === expense.spent_at) last.items.push(expense);
    else groups.push({ day: expense.spent_at, items: [expense] });
  }
  return groups;
}

export default function ExpensesPage() {
  const { month } = useMonth();
  const expenses = useExpenses(month);
  const summary = useSummary(month);
  const openSheet = useExpenseSheet();
  const currency = summary.data?.currency;
  const { t, money, monthName, dayLabel } = useI18n();
  const errorMessage = useErrorMessage();

  return (
    <>
      <header className="mb-10">
        <MonthSwitcher />
      </header>

      {expenses.isPending ? (
        <PageLoader />
      ) : expenses.isError ? (
        <LoadError message={errorMessage(expenses.error)} onRetry={() => expenses.refetch()} />
      ) : expenses.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-10">
          <p className="font-display text-xl font-semibold">{t.expenses.empty(monthName(month))}</p>
          <p className="mt-1 text-[15px] text-muted">
            {t.expenses.emptyHint}
          </p>
          <Button className="mt-5" onClick={() => openSheet()}>
            {t.expenses.addFirst}
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {groupByDay(expenses.data).map(({ day, items }) => {
            const dayTotal = items.reduce((sum, item) => sum + Number(item.amount_base), 0);
            return (
              <section key={day} aria-label={dayLabel(day)}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="font-semibold">{dayLabel(day)}</h2>
                  {currency && (
                    <span className="tabular text-sm text-muted">{money(dayTotal, currency)}</span>
                  )}
                </div>
                <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
                  <AnimatePresence initial={false}>
                    {items.map((expense) => (
                      <ExpenseRow key={expense.uuid} expense={expense} budgetCurrency={currency} />
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
