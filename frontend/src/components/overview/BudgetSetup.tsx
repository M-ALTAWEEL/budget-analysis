"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useAuth, useCurrentUser } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { Field, FormError } from "@/components/ui/Field";
import { useCategories, useSetAllocations, useSetBudget, useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount } from "@/lib/money";
import { shiftMonth } from "@/lib/month";
import { getMe } from "@/services/auth";
import type { Currency } from "@/types/api";

/** Shown when the month has no budget yet. */
export function BudgetSetup({ month }: { month: string }) {
  const user = useCurrentUser();
  const setBudget = useSetBudget(month);
  const setAllocations = useSetAllocations(month);
  const previous = useSummary(shiftMonth(month, -1)).data; // null: no budget last month
  const categories = useCategories().data;
  const [copying, setCopying] = useState(false);
  const { updateUser } = useAuth();
  const [total, setTotal] = useState("");
  const [currency, setCurrency] = useState<Currency>(user.base_currency);
  const [error, setError] = useState<string | null>(null);
  const { t, monthName, money } = useI18n();
  const errorMessage = useErrorMessage();
  const name = monthName(month);

  // Last month's limits, for the categories that still exist.
  const visible = new Set(categories?.map((c) => c.uuid));
  const previousLimits = (previous?.categories ?? [])
    .filter((row) => row.limit_amount !== null && visible.has(row.category.uuid))
    .map((row) => ({ category_uuid: row.category.uuid, limit_amount: row.limit_amount as string }));

  /** One click: the same total, currency and category limits as last month. */
  async function copyLastMonth() {
    if (!previous) return;
    setError(null);
    setCopying(true);
    try {
      await setBudget.mutateAsync({ total: previous.total_amount, currency: previous.currency });
      if (previousLimits.length > 0) await setAllocations.mutateAsync(previousLimits);
      if (previous.currency !== user.base_currency) updateUser(await getMe());
      toast.success(t.setup.done(name));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCopying(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isValidAmount(total)) return setError(t.setup.invalidAmount);
    try {
      await setBudget.mutateAsync({ total: total.trim(), currency });
      // A new currency becomes the main one (new expenses, next months): refresh it.
      if (currency !== user.base_currency) updateUser(await getMe());
      toast.success(t.setup.done(name));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <h2 className="font-display text-3xl font-semibold">{t.setup.title(name)}</h2>
      <p className="mt-2 text-[15px] text-muted">
        {t.setup.intro}
      </p>
      {previous && (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
          <p className="font-semibold">{t.setup.sameAsLast(monthName(shiftMonth(month, -1)))}</p>
          <p className="mt-1 text-sm text-muted">
            {t.setup.sameAsLastDetail(money(previous.total_amount, previous.currency), previousLimits.length)}
          </p>
          <Button type="button" variant="secondary" className="mt-4" onClick={copyLastMonth} loading={copying}>
            {t.setup.useLastMonth}
          </Button>
        </div>
      )}
      {previous && <p className="mt-6 text-sm text-muted">{t.setup.orNew}</p>}
      <div className="mt-6 space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field
            label={t.setup.monthlyBudget}
            inputMode="decimal"
            placeholder="8000"
            value={total}
            onChange={(e) => setTotal(e.target.value.replace(",", "."))}
            autoFocus
            required
          />
          <CurrencySelect
            label={t.expenses.currency}
            value={currency}
            onChange={setCurrency}
            keep={[user?.base_currency]}
            short
          />
        </div>
        <p className="text-sm text-muted">{t.setup.currencyHint}</p>
        <FormError message={error} />
        <Button type="submit" loading={setBudget.isPending}>
          {t.setup.submit(name)}
        </Button>
      </div>
    </form>
  );
}
