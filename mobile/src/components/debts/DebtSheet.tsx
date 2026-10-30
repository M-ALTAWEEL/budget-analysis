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
import { useDeleteDebt, useSaveDebt } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount, toInputAmount } from "@/lib/money";
import { todayISO } from "@/lib/month";
import { useColors } from "@/theme/ThemeProvider";
import type { Currency, Debt } from "@/types/api";

/** Add or change a debt, like the website's sheet. */
export function DebtSheet({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  const user = useCurrentUser();
  const save = useSaveDebt();
  const remove = useDeleteDebt();
  const { t } = useI18n();
  const colors = useColors();
  const errorMessage = useErrorMessage();

  const [direction, setDirection] = useState<Debt["direction"]>(debt?.direction ?? "lent");
  const [person, setPerson] = useState(debt?.person ?? "");
  const [amount, setAmount] = useState(debt ? toInputAmount(debt.amount) : "");
  const [currency, setCurrency] = useState<Currency>(debt?.currency ?? user.base_currency);
  const [note, setNote] = useState(debt?.note ?? "");
  const [startedOn, setStartedOn] = useState(debt?.started_on ?? todayISO());
  const [dueOn, setDueOn] = useState(debt?.due_on ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function submit() {
    setError(null);
    if (!person.trim()) return setError(t.debts.needPerson);
    if (!isValidAmount(amount)) return setError(t.expenses.invalidAmount);
    try {
      await save.mutateAsync({
        uuid: debt?.uuid,
        input: { person: person.trim(), direction, amount: amount.trim(), currency, note: note.trim() || null, started_on: startedOn, due_on: dueOn || null },
      });
      toast.success(debt ? t.debts.saved : t.debts.added);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete() {
    if (!debt) return;
    if (!confirmingDelete) return setConfirmingDelete(true);
    try {
      await remove.mutateAsync(debt.uuid);
      toast.success(t.debts.deleted);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Sheet
      title={debt ? t.debts.editTitle : t.debts.newTitle}
      onClose={onClose}
      footer={
        <>
          <Button onPress={submit} loading={save.isPending}>{debt ? t.expenses.saveChanges : t.debts.add}</Button>
          {debt && (
            <Button variant="danger" onPress={handleDelete} loading={remove.isPending}>
              {confirmingDelete ? t.common.tapAgainToDelete : t.common.delete}
            </Button>
          )}
        </>
      }>
      <View style={{ gap: 16 }}>
        {!debt && (
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 8 }}>
            {(["lent", "borrowed"] as const).map((value) => {
              const selected = direction === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setDirection(value)}
                  style={{
                    flex: 1, alignItems: "center", borderRadius: 12, paddingVertical: 12,
                    borderWidth: selected ? 2 : 1, borderColor: selected ? colors.pine : colors.line,
                    backgroundColor: selected ? colors.pineSoft : colors.surface,
                  }}>
                  <Text weight="semibold">{value === "lent" ? t.debts.lent : t.debts.borrowed}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <Field label={t.debts.person} placeholder={t.debts.personPlaceholder} maxLength={100} value={person} onChangeText={setPerson} autoFocus={!debt} />
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
          <Field style={{ flex: 1 }} label={t.expenses.amount} keyboardType="decimal-pad" placeholder="0.00" value={amount} onChangeText={(text) => setAmount(text.replace(",", "."))} />
          {debt ? (
            <Field style={{ width: 110 }} label={t.expenses.currency} value={currency} editable={false} />
          ) : (
            <CurrencySelect style={{ width: 110 }} label={t.expenses.currency} value={currency} keep={[user.base_currency]} short onChange={setCurrency} />
          )}
        </View>
        <Field label={t.debts.note} maxLength={200} value={note} onChangeText={setNote} />
        {!debt && <DateField label={t.debts.started} value={startedOn} max={todayISO()} onChange={setStartedOn} />}
        <DateField label={t.debts.due} value={dueOn} min={startedOn} onChange={setDueOn} optional />
        <FormError message={error} />
      </View>
    </Sheet>
  );
}
