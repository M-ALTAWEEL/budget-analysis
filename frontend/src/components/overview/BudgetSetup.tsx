"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useCurrentUser } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { useSetBudget } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount } from "@/lib/money";

/** Shown when the month has no budget yet. */
export function BudgetSetup({ month }: { month: string }) {
  const user = useCurrentUser();
  const setBudget = useSetBudget(month);
  const [total, setTotal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { t, monthName } = useI18n();
  const errorMessage = useErrorMessage();
  const name = monthName(month);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isValidAmount(total)) return setError(t.setup.invalidAmount);
    try {
      await setBudget.mutateAsync(total.trim());
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
        <Field
          label={t.setup.monthlyBudget}
          inputMode="decimal"
          placeholder="8000"
          suffix={user.base_currency}
          value={total}
          onChange={(e) => setTotal(e.target.value.replace(",", "."))}
          autoFocus
          required
        />
        <FormError message={error} />
        <Button type="submit" loading={setBudget.isPending}>
          {t.setup.submit(name)}
        </Button>
      </div>
    </form>
  );
}
