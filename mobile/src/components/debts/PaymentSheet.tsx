import { useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
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

  async function submit() {
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

  async function settleAll() {
    try {
      await settle.mutateAsync(debt.uuid);
      toast.success(t.debts.settled);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Sheet
      title={t.debts.payPart}
      onClose={onClose}
      footer={
        <>
          <Button onPress={submit} loading={pay.isPending}>{t.debts.paidBack}</Button>
          <Button variant="secondary" onPress={settleAll} loading={settle.isPending}>{t.debts.settle}</Button>
        </>
      }>
      <View style={{ gap: 16 }}>
        <Text tone="muted">
          {debt.direction === "lent" ? t.debts.theyOwe(debt.person) : t.debts.iOwe(debt.person)} · {t.debts.left(money(debt.remaining, debt.currency))}
        </Text>
        <Field label={t.debts.payAmount} keyboardType="decimal-pad" placeholder="0.00" suffix={debt.currency} value={amount} onChangeText={(text) => setAmount(text.replace(",", "."))} autoFocus />
        <FormError message={error} />
      </View>
    </Sheet>
  );
}
