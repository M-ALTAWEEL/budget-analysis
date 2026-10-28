import { useState } from "react";
import { View } from "react-native";

import { useAuth, useCurrentUser } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { Field, FormError } from "@/components/ui/Field";
import { Card } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useCategories, useSetAllocations, useSetBudget, useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount } from "@/lib/money";
import { shiftMonth } from "@/lib/month";
import { getMe } from "@/services/auth";
import type { Currency } from "@/types/api";

/** Shown when the month has no budget yet (the website's BudgetSetup). */
export function BudgetSetup({ month }: { month: string }) {
  const user = useCurrentUser();
  const setBudget = useSetBudget(month);
  const setAllocations = useSetAllocations(month);
  const previous = useSummary(shiftMonth(month, -1)).data;
  const categories = useCategories().data;
  const [copying, setCopying] = useState(false);
  const { updateUser } = useAuth();
  const [total, setTotal] = useState("");
  const [currency, setCurrency] = useState<Currency>(user.base_currency);
  const [error, setError] = useState<string | null>(null);
  const { t, monthName, money } = useI18n();
  const errorMessage = useErrorMessage();
  const name = monthName(month);

  const visible = new Set(categories?.map((c) => c.uuid));
  const previousLimits = (previous?.categories ?? [])
    .filter((row) => row.limit_amount !== null && visible.has(row.category.uuid))
    .map((row) => ({ category_uuid: row.category.uuid, limit_amount: row.limit_amount as string }));

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

  async function submit() {
    setError(null);
    if (!isValidAmount(total)) return setError(t.setup.invalidAmount);
    try {
      await setBudget.mutateAsync({ total: total.trim(), currency });
      if (currency !== user.base_currency) updateUser(await getMe());
      toast.success(t.setup.done(name));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <View>
      <Text display weight="semibold" size={30}>{t.setup.title(name)}</Text>
      <Text size={15} tone="muted" style={{ marginTop: 8 }}>{t.setup.intro}</Text>
      {previous && (
        <Card style={{ marginTop: 24 }}>
          <Text weight="semibold">{t.setup.sameAsLast(monthName(shiftMonth(month, -1)))}</Text>
          <Text size={14} tone="muted" style={{ marginTop: 4 }}>
            {t.setup.sameAsLastDetail(money(previous.total_amount, previous.currency), previousLimits.length)}
          </Text>
          <Button variant="secondary" style={{ marginTop: 16, alignSelf: "flex-start" }} onPress={copyLastMonth} loading={copying}>
            {t.setup.useLastMonth}
          </Button>
        </Card>
      )}
      {previous && <Text size={14} tone="muted" style={{ marginTop: 24 }}>{t.setup.orNew}</Text>}
      <View style={{ marginTop: 24, gap: 16 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
          <Field
            style={{ flex: 1 }}
            label={t.setup.monthlyBudget}
            keyboardType="decimal-pad"
            placeholder="8000"
            value={total}
            onChangeText={(text) => setTotal(text.replace(",", "."))}
            autoFocus
          />
          <CurrencySelect
            style={{ width: 110 }}
            label={t.expenses.currency}
            value={currency}
            short
            onChange={setCurrency}
          />
        </View>
        <Text size={14} tone="muted">{t.setup.currencyHint}</Text>
        <FormError message={error} />
        <Button onPress={submit} loading={setBudget.isPending}>{t.setup.submit(name)}</Button>
      </View>
    </View>
  );
}
