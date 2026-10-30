"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useDebtPayment, useSettleDebt } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount } from "@/lib/money";
import type { Debt } from "@/types/api";

/** Part of a debt paid back, or all of it. */
export function PaymentSheet({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const pay = useDebtPayment();
  const settle = useSettleDebt();
  const { t, money } = useI18n();
  const errorMessage = useErrorMessage();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isValidAmount(amount)) return setError(t.expenses.invalidAmount);
    if (Number(amount) > Number(debt.remaining)) return setError(t.debts.tooMuch);
    try {
      await pay.mutateAsync({ uuid: debt.uuid, amount: amount.trim() });
      toast.success(t.debts.saved);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleSettle() {
    try {
      await settle.mutateAsync(debt.uuid);
      toast.success(t.debts.settled);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Sheet title={t.debts.payPart} onClose={onClose} onSubmit={handleSubmit}>
      <div className="space-y-4">
        <p className="text-[15px] text-muted">
          <bdi>{debt.direction === "lent" ? t.debts.theyOwe(debt.person) : t.debts.iOwe(debt.person)}</bdi> ·{" "}
          {t.debts.left(money(debt.remaining, debt.currency))}
        </p>
        <Field
          label={t.debts.payAmount}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          suffix={debt.currency}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(",", "."))}
          autoFocus
          required
        />
        <FormError message={error} />
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="secondary" onClick={handleSettle} loading={settle.isPending}>
          {t.debts.settle}
        </Button>
        <Button type="submit" loading={pay.isPending}>
          {t.debts.paidBack}
        </Button>
      </div>
    </Sheet>
  );
}
