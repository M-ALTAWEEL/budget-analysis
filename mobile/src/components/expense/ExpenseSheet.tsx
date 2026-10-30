import { Sparkles } from "lucide-react-native";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { useCurrentUser } from "@/components/auth/AuthProvider";
import { QuickAddBar } from "@/components/expense/QuickAddBar";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { DateField } from "@/components/ui/DateField";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { SwitchRow } from "@/components/ui/SwitchRow";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useCategories, useCategorySuggestion, useDeleteExpense, useSaveExpense, useSaveRecurring } from "@/hooks/queries";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount, toInputAmount } from "@/lib/money";
import { todayISO } from "@/lib/month";
import { useColors } from "@/theme/ThemeProvider";
import { type Currency, type Expense } from "@/types/api";

type SheetState = { open: false } | { open: true; expense: Expense | null };
const SheetContext = createContext<((expense?: Expense) => void) | null>(null);

/** Any screen can open the sheet: to add (no argument) or to edit an expense. */
export function useExpenseSheet() {
  const openSheet = useContext(SheetContext);
  if (!openSheet) throw new Error("useExpenseSheet must be used inside <ExpenseSheetProvider>");
  return openSheet;
}

export function ExpenseSheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SheetState>({ open: false });
  const openSheet = useCallback((expense?: Expense) => setState({ open: true, expense: expense ?? null }), []);
  const close = useCallback(() => setState({ open: false }), []);
  return (
    <SheetContext.Provider value={openSheet}>
      {children}
      {state.open && <ExpenseSheet key={state.expense?.uuid ?? "new"} expense={state.expense} onClose={close} />}
    </SheetContext.Provider>
  );
}

function ExpenseSheet({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const user = useCurrentUser();
  const categories = useCategories();
  const save = useSaveExpense();
  const remove = useDeleteExpense();
  const saveRecurring = useSaveRecurring();
  const { t, categoryName } = useI18n();
  const colors = useColors();
  const errorMessage = useErrorMessage();

  const [amount, setAmount] = useState(expense ? toInputAmount(expense.amount) : "");
  const [currency, setCurrency] = useState<Currency>(expense?.currency ?? user.base_currency);
  const [description, setDescription] = useState(expense?.description ?? "");
  const [pickedUuid, setPickedUuid] = useState(expense?.category.uuid ?? "");
  const [spentAt, setSpentAt] = useState(expense?.spent_at ?? todayISO());
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [repeat, setRepeat] = useState(false); // "Repeat every month" (feature F1)

  const typed = useDebouncedValue(description.trim());
  const asking = !expense && !pickedUuid ? typed : "";
  const suggestion = useCategorySuggestion(asking);
  const suggested = asking.length >= 2 && description.trim() ? suggestion.data?.category : null;
  const suggestedUuid = suggested && categories.data?.some((c) => c.uuid === suggested.uuid) ? suggested.uuid : "";
  const categoryUuid = pickedUuid || suggestedUuid || "";
  const autoPicked = !pickedUuid && Boolean(suggestedUuid);

  async function submit() {
    setError(null);
    if (!isValidAmount(amount)) return setError(t.expenses.invalidAmount);
    if (!description.trim()) return setError(t.expenses.needDescription);
    if (!categoryUuid) return setError(t.expenses.needCategory);
    try {
      const saved = await save.mutateAsync({
        uuid: expense?.uuid,
        input: { amount: amount.trim(), currency, description: description.trim(), category_uuid: categoryUuid, spent_at: spentAt },
      });
      if (saved === null) {
        // No connection: it waits on the device and is sent when the connection is back.
        toast.success(t.offline.queued);
        onClose();
        return;
      }
      if (!expense && repeat) {
        await saveRecurring.mutateAsync({
          input: {
            description: saved.description,
            amount: saved.amount,
            currency: saved.currency,
            category_uuid: saved.category.uuid,
            day_of_month: Number(saved.spent_at.slice(8, 10)),
            from_expense_uuid: saved.uuid, // this month's: not added a second time
          },
        });
      }
      toast.success(expense ? t.expenses.saved : t.expenses.added);
      onClose();
    } catch (err) {
      setError(errorMessage(err, { 409: t.errors.needBudget }));
    }
  }

  async function handleDelete() {
    if (!expense) return;
    if (!confirmingDelete) return setConfirmingDelete(true);
    try {
      await remove.mutateAsync(expense.uuid);
      toast.success(t.expenses.deleted);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Sheet
      title={expense ? t.expenses.editTitle : t.expenses.newTitle}
      onClose={onClose}
      footer={
        <>
          <Button onPress={submit} loading={save.isPending || saveRecurring.isPending}>{expense ? t.expenses.saveChanges : t.expenses.add}</Button>
          {expense && (
            <Button variant="danger" onPress={handleDelete} loading={remove.isPending}>
              {confirmingDelete ? t.common.tapAgainToDelete : t.common.delete}
            </Button>
          )}
        </>
      }>
      <View style={{ gap: 16 }}>
        {expense?.source === "group" && (
          <Text size={14} style={{ borderRadius: 12, backgroundColor: colors.pineSoft, paddingHorizontal: 14, paddingVertical: 10, overflow: "hidden" }}>
            {t.groups.copyNote}
          </Text>
        )}
        {!expense && (
          <QuickAddBar
            onFound={(found) => {
              if (found.amount !== null) setAmount(toInputAmount(found.amount));
              if (found.currency) setCurrency(found.currency);
              if (found.description) setDescription(found.description);
              setSpentAt(found.spent_at);
              if (found.category && categories.data?.some((c) => c.uuid === found.category!.uuid)) {
                setPickedUuid(found.category.uuid);
              }
            }}
          />
        )}
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
          <Field
            style={{ flex: 1 }}
            label={t.expenses.amount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            value={amount}
            onChangeText={(text) => setAmount(text.replace(",", "."))}
            autoFocus={!expense}
          />
          <CurrencySelect
            style={{ width: 110 }}
            label={t.expenses.currency}
            value={currency}
            keep={[user.base_currency]}
            short
            onChange={setCurrency}
          />
        </View>

        <Field
          label={t.expenses.what}
          placeholder={t.expenses.whatPlaceholder}
          maxLength={200}
          value={description}
          onChangeText={setDescription}
        />

        <View>
          <Text size={14} weight="medium" style={{ marginBottom: 6 }}>{t.expenses.category}</Text>
          {autoPicked && (
            <View style={{ marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 6 }} accessibilityLiveRegion="polite">
              <Sparkles size={14} color={colors.pine} />
              <Text size={12} tone="muted">{t.expenses.autoPicked}</Text>
            </View>
          )}
          {categories.isPending ? (
            <Text size={14} tone="muted">{t.expenses.loadingCategories}</Text>
          ) : (
            <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {categories.data?.map((category) => {
                const selected = category.uuid === categoryUuid;
                return (
                  <Pressable
                    key={category.uuid}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => setPickedUuid(category.uuid)}
                    style={{
                      width: "48.5%", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 8,
                      borderWidth: selected ? 2 : 1, borderColor: selected ? colors.pine : colors.line,
                      backgroundColor: selected ? colors.pineSoft : colors.surface, margin: selected ? 0 : 0,
                    }}>
                    <CategoryIcon category={category} size="sm" />
                    <Text size={14} weight={selected ? "semibold" : "regular"} numberOfLines={1} style={{ flex: 1 }}>
                      {categoryName(category)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <DateField label={t.expenses.date} value={spentAt} max={todayISO()} onChange={setSpentAt} />
        {!expense && <SwitchRow label={t.expenses.repeatMonthly} hint={t.expenses.repeatHint} value={repeat} onChange={setRepeat} />}
        <FormError message={error} />
      </View>
    </Sheet>
  );
}
