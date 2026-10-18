"use client";

import { useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useI18n } from "@/i18n/I18nProvider";
import type { Currency, Expense } from "@/types/api";

/** One expense. Click to edit. Foreign-currency amounts also show the converted value. */
export function ExpenseRow({ expense, budgetCurrency }: { expense: Expense; budgetCurrency?: Currency }) {
  const openSheet = useExpenseSheet();
  const converted = budgetCurrency && expense.currency !== budgetCurrency;
  const { money, categoryName } = useI18n();

  return (
    <li>
      <button
        type="button"
        onClick={() => openSheet(expense)}
        className="flex w-full items-center gap-4 px-4 py-3 text-start hover:bg-ink/[0.03] sm:px-5"
      >
        <CategoryIcon category={expense.category} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{expense.description}</span>
          <span className="block truncate text-sm text-muted">{categoryName(expense.category)}</span>
        </span>
        <span className="tabular shrink-0 text-end">
          <span className="block font-semibold">{money(expense.amount, expense.currency)}</span>
          {budgetCurrency && converted && (
            <span className="block text-sm text-muted">{money(expense.amount_base, budgetCurrency)}</span>
          )}
        </span>
      </button>
    </li>
  );
}
