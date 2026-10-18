"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useAuth, useCurrentUser } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Select } from "@/components/ui/Field";
import { useSetBudget } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount } from "@/lib/money";
import { getMe } from "@/services/auth";
import { CURRENCIES, type Currency } from "@/types/api";

/** Shown when the month has no budget yet. */
export function BudgetSetup({ month }: { month: string }) {
  const user = useCurrentUser();
  const setBudget = useSetBudget(month);
  const { updateUser } = useAuth();
  const [total, setTotal] = useState("");
  const [currency, setCurrency] = useState<Currency>(user.base_currency);
  const [error, setError] = useState<string | null>(null);
  const { t, monthName } = useI18n();
  const errorMessage = useErrorMessage();
  const name = monthName(month);

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
          <Select
            label={t.expenses.currency}
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
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
