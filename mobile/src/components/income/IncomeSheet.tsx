import { useState } from "react";
import { Pressable, View } from "react-native";

import { useCurrentUser } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { DateField } from "@/components/ui/DateField";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useDeleteIncome, useSaveIncome } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount, toInputAmount } from "@/lib/money";
import { todayISO } from "@/lib/month";
import { useColors } from "@/theme/ThemeProvider";
import type { Currency, Income, IncomeKind } from "@/types/api";

export const INCOME_KINDS: IncomeKind[] = ["job", "scholarship", "family", "freelance", "other"];

/** Add or change one amount received, like the website's sheet. */
export function IncomeSheet({ income, onClose }: { income: Income | null; onClose: () => void }) {
  const user = useCurrentUser();
  const save = useSaveIncome();
  const remove = useDeleteIncome();
  const { t } = useI18n();
  const colors = useColors();
  const errorMessage = useErrorMessage();

  const [source, setSource] = useState(income?.source ?? "");
  const [kind, setKind] = useState<IncomeKind>(income?.kind ?? "job");
  const [amount, setAmount] = useState(income ? toInputAmount(income.amount) : "");
  const [currency, setCurrency] = useState<Currency>(income?.currency ?? user.base_currency);
  const [receivedOn, setReceivedOn] = useState(income?.received_on ?? todayISO());
  const [note, setNote] = useState(income?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function submit() {
    setError(null);
    if (!source.trim()) return setError(t.income.needSource);
    if (!isValidAmount(amount)) return setError(t.expenses.invalidAmount);
    try {
      await save.mutateAsync({
        uuid: income?.uuid,
        input: { source: source.trim(), kind, amount: amount.trim(), currency, received_on: receivedOn, note: note.trim() || null },
      });
      toast.success(income ? t.income.saved : t.income.added);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete() {
    if (!income) return;
    if (!confirmingDelete) return setConfirmingDelete(true);
    try {
      await remove.mutateAsync(income.uuid);
      toast.success(t.income.deleted);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Sheet
      title={income ? t.income.editTitle : t.income.newTitle}
      onClose={onClose}
      footer={
        <>
          <Button onPress={submit} loading={save.isPending}>{income ? t.expenses.saveChanges : t.income.add}</Button>
          {income && (
            <Button variant="danger" onPress={handleDelete} loading={remove.isPending}>
              {confirmingDelete ? t.common.tapAgainToDelete : t.common.delete}
            </Button>
          )}
        </>
      }>
      <View style={{ gap: 16 }}>
        <Field label={t.income.source} placeholder={t.income.sourcePlaceholder} maxLength={100} value={source} onChangeText={setSource} autoFocus={!income} />
        <View style={{ gap: 6 }}>
          <Text size={14} weight="semibold">{t.income.kind}</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {INCOME_KINDS.map((value) => {
              const selected = kind === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setKind(value)}
                  style={{
                    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
                    borderWidth: selected ? 2 : 1, borderColor: selected ? colors.pine : colors.line,
                    backgroundColor: selected ? colors.pineSoft : colors.surface,
                  }}>
                  <Text size={14} weight="semibold">{t.income.kinds[value]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
          <Field style={{ flex: 1 }} label={t.expenses.amount} keyboardType="decimal-pad" placeholder="0.00" value={amount} onChangeText={(text) => setAmount(text.replace(",", "."))} />
          <CurrencySelect style={{ width: 110 }} label={t.expenses.currency} value={currency} keep={[user.base_currency, currency]} short onChange={setCurrency} />
        </View>
        <DateField label={t.income.received} value={receivedOn} max={todayISO()} onChange={setReceivedOn} />
        <Field label={t.income.note} maxLength={200} value={note} onChangeText={setNote} />
        <FormError message={error} />
      </View>
    </Sheet>
  );
}
