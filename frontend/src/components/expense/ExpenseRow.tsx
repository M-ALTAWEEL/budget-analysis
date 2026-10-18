"use client";

import { useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { formatMoney } from "@/lib/money";
import type { Currency, Expense } from "@/types/api";

/** One expense. Click to edit. Foreign-currency amounts also show the converted value. */
export function ExpenseRow({ expense, budgetCurrency }: { expense: Expense; budgetCurrency?: Currency }) {
  const openSheet = useExpenseSheet();
  const converted = budgetCurrency && expense.currency !== budgetCurrency;

  return (
    <li>
      <button
        type="button"
        onClick={() => openSheet(expense)}
        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-ink/[0.03] sm:px-5"
      >
        <CategoryIcon category={expense.category} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{expense.description}</span>
          <span className="block truncate text-sm text-muted">{expense.category.name}</span>
        </span>
        <span className="tabular shrink-0 text-right">
          <span className="block font-semibold">{formatMoney(expense.amount, expense.currency)}</span>
          {budgetCurrency && converted && (
            <span className="block text-sm text-muted">{formatMoney(expense.amount_base, budgetCurrency)}</span>
          )}
        </span>
      </button>
    </li>
  );
}
