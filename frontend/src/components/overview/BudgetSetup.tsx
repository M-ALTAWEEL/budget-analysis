"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useCurrentUser } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { useSetBudget } from "@/hooks/queries";
import { errorMessage } from "@/lib/errors";
import { isValidAmount } from "@/lib/money";
import { monthName } from "@/lib/month";

/** Shown when the month has no budget yet. */
export function BudgetSetup({ month }: { month: string }) {
  const user = useCurrentUser();
  const setBudget = useSetBudget(month);
  const [total, setTotal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const name = monthName(month);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isValidAmount(total)) return setError("Enter an amount like 8000 or 7500.50.");
    try {
      await setBudget.mutateAsync(total.trim());
      toast.success(`Budget set for ${name}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <h2 className="font-display text-3xl font-semibold">How much do you have for {name}?</h2>
      <p className="mt-2 text-[15px] text-muted">
        Enter your allowance for the month. You can split it into categories after.
      </p>
      <div className="mt-6 space-y-4">
        <Field
          label="Monthly budget"
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
          Set budget for {name}
        </Button>
      </div>
    </form>
  );
}
