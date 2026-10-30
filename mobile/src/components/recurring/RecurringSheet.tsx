import { useState } from "react";
import { Pressable, View } from "react-native";

import { useCurrentUser } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { DateField } from "@/components/ui/DateField";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { SwitchRow } from "@/components/ui/SwitchRow";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useCategories, useDeleteRecurring, useSaveRecurring } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount, toInputAmount } from "@/lib/money";
import { useColors } from "@/theme/ThemeProvider";
import type { Currency, RecurringExpense } from "@/types/api";

/** Add or change a recurring expense, like the website's sheet. */
export function RecurringSheet({ rule, onClose }: { rule: RecurringExpense | null; onClose: () => void }) {
  const user = useCurrentUser();
  const categories = useCategories();
  const save = useSaveRecurring();
  const remove = useDeleteRecurring();
  const { t, categoryName } = useI18n();
  const colors = useColors();
  const errorMessage = useErrorMessage();

  const [description, setDescription] = useState(rule?.description ?? "");
  const [amount, setAmount] = useState(rule ? toInputAmount(rule.amount) : "");
  const [currency, setCurrency] = useState<Currency>(rule?.currency ?? user.base_currency);
  const [categoryUuid, setCategoryUuid] = useState(rule?.category.uuid ?? "");
  const [day, setDay] = useState(String(rule?.day_of_month ?? new Date().getDate()));
  const [endsOn, setEndsOn] = useState(rule?.ends_on ?? "");
  const [remind, setRemind] = useState(rule?.remind ?? true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function submit() {
    setError(null);
    const dayNumber = Number(day);
    if (!description.trim()) return setError(t.expenses.needDescription);
    if (!isValidAmount(amount)) return setError(t.expenses.invalidAmount);
    if (!categoryUuid) return setError(t.expenses.needCategory);
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) return setError(t.recurring.invalidDay);
    try {
      await save.mutateAsync({
        uuid: rule?.uuid,
        input: {
          description: description.trim(),
          amount: amount.trim(),
          currency,
          category_uuid: categoryUuid,
          day_of_month: dayNumber,
          ends_on: endsOn || null,
          remind,
        },
      });
      toast.success(rule ? t.recurring.saved : t.recurring.added);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete() {
    if (!rule) return;
    if (!confirmingDelete) return setConfirmingDelete(true);
    try {
      await remove.mutateAsync(rule.uuid);
      toast.success(t.recurring.deleted);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Sheet
      title={rule ? t.recurring.editTitle : t.recurring.newTitle}
      onClose={onClose}
      footer={
        <>
          <Button onPress={submit} loading={save.isPending}>{rule ? t.expenses.saveChanges : t.recurring.add}</Button>
          {rule && (
            <Button variant="danger" onPress={handleDelete} loading={remove.isPending}>
              {confirmingDelete ? t.common.tapAgainToDelete : t.common.delete}
            </Button>
          )}
          {confirmingDelete && <Text size={12} tone="muted" style={{ textAlign: "center" }}>{t.recurring.deleteNote}</Text>}
        </>
      }>
      <View style={{ gap: 16 }}>
        <Field label={t.expenses.what} placeholder={t.expenses.whatPlaceholder} maxLength={200} value={description} onChangeText={setDescription} autoFocus={!rule} />
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
          <Field style={{ flex: 1 }} label={t.expenses.amount} keyboardType="decimal-pad" placeholder="0.00" value={amount} onChangeText={(text) => setAmount(text.replace(",", "."))} />
          <CurrencySelect style={{ width: 110 }} label={t.expenses.currency} value={currency} keep={[user.base_currency]} short onChange={setCurrency} />
        </View>

        <View>
          <Text size={14} weight="medium" style={{ marginBottom: 6 }}>{t.expenses.category}</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {categories.data?.map((category) => {
              const selected = category.uuid === categoryUuid;
              return (
                <Pressable
                  key={category.uuid}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setCategoryUuid(category.uuid)}
                  style={{
                    width: "48.5%", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 8,
                    borderWidth: selected ? 2 : 1, borderColor: selected ? colors.pine : colors.line,
                    backgroundColor: selected ? colors.pineSoft : colors.surface,
                  }}>
                  <CategoryIcon category={category} size="sm" />
                  <Text size={14} weight={selected ? "semibold" : "regular"} numberOfLines={1} style={{ flex: 1 }}>{categoryName(category)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Field label={t.recurring.day} hint={t.recurring.dayHint} keyboardType="number-pad" maxLength={2} value={day} onChangeText={(text) => setDay(text.replace(/\D/g, ""))} ltr />
        <DateField label={t.recurring.endsOn} value={endsOn} onChange={setEndsOn} optional />
        <SwitchRow label={t.recurring.remind} hint={t.recurring.remindHint} value={remind} onChange={setRemind} />
        <FormError message={error} />
      </View>
    </Sheet>
  );
}
