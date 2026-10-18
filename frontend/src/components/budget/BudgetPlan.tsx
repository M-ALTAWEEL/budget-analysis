"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Field, FormError } from "@/components/ui/Field";
import { useSetAllocations, useSetBudget } from "@/hooks/queries";
import { errorMessage } from "@/lib/errors";
import { AMOUNT_PATTERN, formatMoney, isValidAmount, toInputAmount } from "@/lib/money";
import { monthName } from "@/lib/month";
import type { BudgetSummary, Category } from "@/types/api";

export function TotalForm({ summary, month }: { summary: BudgetSummary; month: string }) {
  const setBudget = useSetBudget(month);
  const [total, setTotal] = useState(toInputAmount(summary.total_amount));
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isValidAmount(total)) return setError("Enter an amount like 8000 or 7500.50.");
    try {
      await setBudget.mutateAsync(total.trim());
      toast.success("Budget updated");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field
          className="flex-1"
          label={`Budget for ${monthName(month)}`}
          inputMode="decimal"
          suffix={summary.currency}
          value={total}
          onChange={(e) => setTotal(e.target.value.replace(",", "."))}
        />
        <Button type="submit" variant="secondary" loading={setBudget.isPending}>
          Update budget
        </Button>
      </div>
      <div className="mt-3">
        <FormError message={error} />
      </div>
    </form>
  );
}

/** One limit per category. Leaving a field empty means "no limit" for that category. */
export function AllocationEditor({
  summary,
  month,
  categories,
}: {
  summary: BudgetSummary;
  month: string;
  categories: Category[];
}) {
  const setAllocations = useSetAllocations(month);
  const [limits, setLimits] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      summary.categories
        .filter((row) => row.limit_amount !== null)
        .map((row) => [row.category.uuid, toInputAmount(row.limit_amount as string)]),
    ),
  );
  const [error, setError] = useState<string | null>(null);

  const total = Number(summary.total_amount);
  const planned = Object.values(limits).reduce(
    (sum, value) => sum + (AMOUNT_PATTERN.test(value.trim()) ? Number(value) : 0),
    0,
  );
  const unplanned = total - planned;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const entries = Object.entries(limits).filter(([, value]) => value.trim() !== "");
    const invalid = entries.find(([, value]) => !AMOUNT_PATTERN.test(value.trim()));
    if (invalid) return setError("Limits must be amounts like 1500 or 250.50.");
    if (unplanned < 0) return setError("Your limits add up to more than the monthly budget.");
    try {
      await setAllocations.mutateAsync(
        entries.map(([category_uuid, value]) => ({ category_uuid, limit_amount: value.trim() })),
      );
      toast.success("Plan saved");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {categories.map((category) => (
          <li key={category.uuid} className="flex items-center gap-4 px-4 py-3 sm:px-5">
            <CategoryIcon category={category} />
            <label htmlFor={`limit-${category.uuid}`} className="flex-1 font-semibold">
              {category.name}
            </label>
            <div className="flex w-40 items-center rounded-xl border border-line bg-surface transition-shadow focus-within:border-pine focus-within:ring-3 focus-within:ring-pine/20">
              <input
                id={`limit-${category.uuid}`}
                inputMode="decimal"
                placeholder="No limit"
                value={limits[category.uuid] ?? ""}
                onChange={(e) =>
                  setLimits((current) => ({
                    ...current,
                    [category.uuid]: e.target.value.replace(",", "."),
                  }))
                }
                className="tabular h-10 w-full min-w-0 bg-transparent px-3 text-right outline-none placeholder:text-muted/70"
              />
              <span className="pr-3 text-sm text-muted">{summary.currency}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={`tabular text-[15px] ${unplanned < 0 ? "text-berry" : "text-muted"}`}>
          Planned {formatMoney(planned, summary.currency)} of {formatMoney(total, summary.currency)}.{" "}
          {unplanned >= 0
            ? `${formatMoney(unplanned, summary.currency)} not assigned to a category.`
            : `${formatMoney(-unplanned, summary.currency)} more than your budget.`}
        </p>
        <Button type="submit" loading={setAllocations.isPending}>
          Save plan
        </Button>
      </div>
      <div className="mt-3">
        <FormError message={error} />
      </div>
    </form>
  );
}
