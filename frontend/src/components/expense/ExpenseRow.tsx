"use client";

import { Users } from "lucide-react";
import { motion } from "motion/react";

import { useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useI18n } from "@/i18n/I18nProvider";
import type { Currency, Expense } from "@/types/api";

/** One expense. Click to edit. Foreign-currency amounts also show the converted value. */
export function ExpenseRow({ expense, budgetCurrency }: { expense: Expense; budgetCurrency?: Currency }) {
  const openSheet = useExpenseSheet();
  const converted = budgetCurrency && expense.currency !== budgetCurrency;
  const { t, money, categoryName } = useI18n();

  return (
    // A new expense opens its row; a deleted one closes it (inside <AnimatePresence>).
    <motion.li
      layout="position"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="overflow-hidden"
    >
      <button
        type="button"
        onClick={() => openSheet(expense)}
        className="flex w-full items-center gap-4 px-4 py-3 text-start hover:bg-ink/[0.03] sm:px-5"
      >
        <CategoryIcon category={expense.category} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{expense.description}</span>
          <span className="flex items-center gap-1.5 truncate text-sm text-muted">
            {categoryName(expense.category)}
            {expense.source === "group" && (
              <span className="inline-flex items-center gap-1" title={t.groups.fromGroup}>
                · <Users className="size-3.5" aria-hidden />
                <span className="sr-only">{t.groups.fromGroup}</span>
              </span>
            )}
          </span>
        </span>
        <span className="tabular shrink-0 text-end">
          <span className="block font-semibold">{money(expense.amount, expense.currency)}</span>
          {budgetCurrency && converted && (
            <span className="block text-sm text-muted">{money(expense.amount_base, budgetCurrency)}</span>
          )}
        </span>
      </button>
    </motion.li>
  );
}
