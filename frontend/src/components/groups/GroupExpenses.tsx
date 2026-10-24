"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useState } from "react";

import { GroupExpenseSheet } from "@/components/groups/GroupExpenseSheet";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { LoadError } from "@/components/ui/LoadError";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import {
  EXPENSES_PAGE,
  GROUP_CATEGORIES,
  listGroupExpenses,
  type GroupDetail,
  type GroupExpense,
} from "@/services/groups";

type Open = { kind: "none" } | { kind: "sheet"; expense: GroupExpense | null };

/** The group's expenses, newest first: who paid, and my share of each. */
export function GroupExpenses({ group }: { group: GroupDetail }) {
  const { t, locale } = useI18n();
  const errorMessage = useErrorMessage();
  const intl = LOCALE_INFO[locale].intl;
  const [open, setOpen] = useState<Open>({ kind: "none" });
  const [expanded, setExpanded] = useState<string | null>(null);

  const expenses = useInfiniteQuery({
    queryKey: ["groups", group.uuid, "expenses"],
    queryFn: ({ pageParam }) => listGroupExpenses(group.uuid, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length === EXPENSES_PAGE ? pages.length * EXPENSES_PAGE : undefined,
  });
  const items = expenses.data?.pages.flat() ?? [];
  const money = (value: string) => formatMoney(value, group.currency, intl);
  const date = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(intl, { day: "numeric", month: "short" });

  return (
    <section aria-labelledby="group-expenses">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="group-expenses" className="font-display text-lg font-semibold">
          {t.groups.expenses}
        </h2>
        <Button className="h-10 px-4 text-sm" onClick={() => setOpen({ kind: "sheet", expense: null })}>
          <Plus className="size-4" aria-hidden />
          {t.groups.addExpense}
        </Button>
      </div>

      {expenses.isError ? (
        <LoadError message={errorMessage(expenses.error)} onRetry={() => expenses.refetch()} />
      ) : expenses.isPending ? (
        <div className="h-24 animate-pulse rounded-2xl bg-ink/5" />
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-[15px] text-muted">
          {t.groups.noExpenses}
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {items.map((expense) => {
            const category = GROUP_CATEGORIES.find((c) => c.slug === expense.category) ?? GROUP_CATEGORIES[7];
            const isOpen = expanded === expense.uuid;
            return (
              <li key={expense.uuid}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? null : expense.uuid)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-start hover:bg-ink/[0.03]"
                >
                  <CategoryIcon category={category} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      <bdi>{expense.description}</bdi>
                    </span>
                    <span className="block truncate text-sm text-muted">
                      {t.groups.paidLine(expense.paid_by.display_name, date(expense.spent_at))}
                    </span>
                  </span>
                  <span className="shrink-0 text-end">
                    <span className="block font-semibold tabular-nums">{money(expense.amount)}</span>
                    <span className="block text-xs text-muted tabular-nums">
                      {expense.my_share !== null ? t.groups.yourShare(money(expense.my_share)) : t.groups.notYours}
                    </span>
                  </span>
                </button>
                {isOpen && (
                  <div className="space-y-3 px-5 pb-4">
                    {expense.original_currency !== group.currency && (
                      <p className="text-sm text-muted">
                        {formatMoney(expense.original_amount, expense.original_currency, intl)}
                      </p>
                    )}
                    <ul className="space-y-1 text-sm">
                      {expense.shares.map((share) => (
                        <li key={share.member.uuid} className="flex justify-between gap-3">
                          <bdi className="truncate">{share.member.display_name}</bdi>
                          <span className="tabular-nums">{money(share.amount)}</span>
                        </li>
                      ))}
                    </ul>
                    {expense.can_edit && (
                      <Button
                        variant="secondary"
                        className="h-9 px-4 text-sm"
                        onClick={() => setOpen({ kind: "sheet", expense })}
                      >
                        {t.groups.edit}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {expenses.hasNextPage && (
        <Button
          variant="ghost"
          className="mt-2 w-full"
          loading={expenses.isFetchingNextPage}
          onClick={() => void expenses.fetchNextPage()}
        >
          {t.groups.showMore}
        </Button>
      )}

      <AnimatePresence>
        {open.kind === "sheet" && (
          <GroupExpenseSheet
            key={open.expense?.uuid ?? "new"}
            group={group}
            expense={open.expense}
            onClose={() => setOpen({ kind: "none" })}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
