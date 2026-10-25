import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { DateField } from "@/components/ui/DateField";
import { Field, FormError, Select } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount, toInputAmount } from "@/lib/money";
import { todayISO } from "@/lib/month";
import {
  deleteGroupExpense, GROUP_CATEGORIES, previewSplit, saveGroupExpense,
  type GroupCategory, type GroupDetail, type GroupExpense, type SplitMethod,
} from "@/services/groups";
import { useColors } from "@/theme/ThemeProvider";
import { CURRENCIES, type Currency } from "@/types/api";

const METHODS: SplitMethod[] = ["equal", "exact", "percent", "shares"];
const VALUE_PATTERN = /^\d{1,10}(\.\d{1,4})?$/;

/** Add a group expense, or change one: what, how much, who paid, and how it's split. */
export function GroupExpenseSheet({ group, expense, onClose }: { group: GroupDetail; expense: GroupExpense | null; onClose: () => void }) {
  const { t, money: format } = useI18n();
  const colors = useColors();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const me = group.members.find((m) => m.is_me);

  const inExpense = new Set(expense?.shares.map((s) => s.member.uuid) ?? []);
  const people = group.members.filter((m) => !m.left || inExpense.has(m.uuid));
  const payers = group.members.filter((m) => !m.left || m.uuid === expense?.paid_by.uuid);

  const [amount, setAmount] = useState(expense ? toInputAmount(expense.original_amount) : "");
  const [currency, setCurrency] = useState<Currency>(expense?.original_currency ?? group.currency);
  const [description, setDescription] = useState(expense?.description ?? "");
  const [category, setCategory] = useState<GroupCategory>(expense?.category ?? "food");
  const [spentAt, setSpentAt] = useState(expense?.spent_at ?? todayISO());
  const [paidBy, setPaidBy] = useState(expense?.paid_by.uuid ?? me?.uuid ?? "");
  const [method, setMethod] = useState<SplitMethod>(expense?.split_method ?? "equal");
  const [included, setIncluded] = useState<Set<string>>(() => new Set(expense ? inExpense : people.filter((m) => !m.left).map((m) => m.uuid)));
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(expense?.shares.map((s) => [s.member.uuid, s.weight ? trimZeros(s.weight) : ""]) ?? []),
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const chosen = people.filter((m) => included.has(m.uuid));
  const total = isValidAmount(amount) ? Number(amount) : 0;
  const numbers = chosen.map((m) => Number(values[m.uuid] || 0));
  const typedSum = numbers.reduce((a, b) => a + b, 0);
  const preview = method === "equal" ? previewSplit(total, chosen.map(() => 1)) : previewSplit(total, numbers);
  const money = (n: number) => format(n, currency);

  const invalidate = () => queryClient.invalidateQueries();
  const save = useMutation({
    mutationFn: () =>
      saveGroupExpense(
        group.uuid,
        {
          description: description.trim(), category, amount: amount.trim(), currency, paid_by: paidBy, spent_at: spentAt,
          split_method: method,
          shares: chosen.map((m) => (method === "equal" ? { member: m.uuid } : { member: m.uuid, value: values[m.uuid] })),
        },
        expense?.uuid,
      ),
    onSuccess: () => {
      void invalidate();
      toast.success(expense ? t.expenses.saved : t.expenses.added);
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: () => deleteGroupExpense(group.uuid, expense?.uuid ?? ""),
    onSuccess: () => {
      void invalidate();
      toast.success(t.expenses.deleted);
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  function remaining(): string {
    if (method === "exact") {
      const diff = Math.round((total - typedSum) * 100) / 100;
      if (diff === 0) return t.groups.allSplit;
      return diff > 0 ? t.groups.leftToSplit(money(diff)) : t.groups.tooMuch(money(-diff));
    }
    if (method === "percent") {
      const diff = Math.round((100 - typedSum) * 10000) / 10000;
      if (diff === 0) return t.groups.allSplit;
      return diff > 0 ? t.groups.percentLeft(String(diff)) : t.groups.percentOver(String(-diff));
    }
    return "";
  }

  function submit() {
    setError(null);
    if (!isValidAmount(amount)) return setError(t.expenses.invalidAmount);
    if (!description.trim()) return setError(t.expenses.needDescription);
    if (chosen.length === 0) return setError(t.groups.pickSomeone);
    if (method !== "equal") {
      const bad = chosen.some((m) => !VALUE_PATTERN.test(values[m.uuid] ?? "") || !(Number(values[m.uuid]) > 0));
      if (bad) return setError(t.groups.needValues);
      if (method === "exact" && Math.round(typedSum * 100) !== Math.round(total * 100)) return setError(remaining());
      if (method === "percent" && Math.round(typedSum * 10000) !== 1000000) return setError(remaining());
    }
    save.mutate();
  }

  function toggle(uuid: string) {
    setIncluded((now) => {
      const next = new Set(now);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  }

  return (
    <Sheet
      title={expense ? t.groups.editExpense : t.groups.newExpense}
      onClose={onClose}
      footer={
        <>
          <Button onPress={submit} loading={save.isPending}>{expense ? t.expenses.saveChanges : t.groups.addExpense}</Button>
          {expense && (
            <Button variant="danger" loading={remove.isPending} onPress={() => (confirmingDelete ? remove.mutate() : setConfirmingDelete(true))}>
              {confirmingDelete ? t.common.tapAgainToDelete : t.common.delete}
            </Button>
          )}
        </>
      }>
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
          <Field style={{ flex: 1 }} label={t.expenses.amount} keyboardType="decimal-pad" placeholder="0.00" value={amount} onChangeText={(text) => setAmount(text.replace(",", "."))} autoFocus={!expense} />
          <Select style={{ width: 110 }} label={t.expenses.currency} value={currency} options={CURRENCIES.map((code) => ({ value: code, label: code }))} onChange={setCurrency} />
        </View>
        {currency !== group.currency && <Text size={14} tone="muted">{t.groups.otherCurrency}</Text>}

        <Field label={t.expenses.what} placeholder={t.expenses.whatPlaceholder} maxLength={200} value={description} onChangeText={setDescription} />

        <View>
          <Text size={14} weight="medium" style={{ marginBottom: 6 }}>{t.expenses.category}</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {GROUP_CATEGORIES.map((c) => {
              const selected = c.slug === category;
              return (
                <Pressable
                  key={c.slug}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setCategory(c.slug)}
                  style={{
                    width: "48.5%", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 8,
                    borderWidth: selected ? 2 : 1, borderColor: selected ? colors.pine : colors.line,
                    backgroundColor: selected ? colors.pineSoft : colors.surface,
                  }}>
                  <CategoryIcon category={c} size="sm" />
                  <Text size={14} weight={selected ? "semibold" : "regular"} numberOfLines={1} style={{ flex: 1 }}>{t.categories.names[c.slug] ?? c.slug}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Select
          label={t.groups.paidBy}
          value={paidBy}
          options={payers.map((m) => ({ value: m.uuid, label: `${m.display_name}${m.is_me ? ` (${t.groups.you})` : ""}` }))}
          onChange={setPaidBy}
        />
        <DateField label={t.expenses.date} value={spentAt} max={todayISO()} onChange={setSpentAt} />

        <View>
          <Text size={14} weight="medium" style={{ marginBottom: 6 }}>{t.groups.splitHow}</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 4, borderRadius: 12, backgroundColor: `${colors.ink}0d`, padding: 4 }}>
            {METHODS.map((m) => {
              const selected = method === m;
              return (
                <Pressable
                  key={m}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setMethod(m)}
                  style={{ flex: 1, alignItems: "center", borderRadius: 8, paddingVertical: 8, backgroundColor: selected ? colors.surface : "transparent" }}>
                  <Text size={13} weight={selected ? "semibold" : "regular"} tone={selected ? "ink" : "muted"} numberOfLines={1}>{t.groups.methods[m]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <Text size={14} weight="medium" style={{ marginBottom: 6 }}>{t.groups.splitBetween}</Text>
          <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }}>
            {people.map((m, index) => {
              const on = included.has(m.uuid);
              const at = chosen.findIndex((c) => c.uuid === m.uuid);
              return (
                <View key={m.uuid} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderColor: colors.line }}>
                  <Pressable
                    onPress={() => toggle(m.uuid)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: on ? colors.pine : colors.line, backgroundColor: on ? colors.pine : "transparent", alignItems: "center", justifyContent: "center" }}>
                      {on && <Check size={14} color={colors.onPine} strokeWidth={3} />}
                    </View>
                    <Text numberOfLines={1} style={{ flex: 1 }}>
                      {m.display_name}
                      {m.is_me ? <Text size={14} tone="muted"> ({t.groups.you})</Text> : null}
                    </Text>
                  </Pressable>
                  {on && method !== "equal" && (
                    <TextInput
                      accessibilityLabel={`${t.groups.methods[method]}: ${m.display_name}`}
                      keyboardType="decimal-pad"
                      placeholder={method === "percent" ? "%" : "0"}
                      placeholderTextColor={`${colors.muted}b3`}
                      value={values[m.uuid] ?? ""}
                      onChangeText={(text) => setValues((v) => ({ ...v, [m.uuid]: text.replace(",", ".") }))}
                      style={{ height: 36, width: 76, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 8, fontSize: 14, color: colors.ink, textAlign: "right" }}
                    />
                  )}
                  {on && method !== "exact" && (
                    <Text size={14} tone="muted" end style={{ width: 88 }}>{total > 0 ? money(preview[at] ?? 0) : ""}</Text>
                  )}
                </View>
              );
            })}
          </View>
          {(method === "exact" || method === "percent") && total > 0 && (
            <Text size={14} tone="muted" style={{ marginTop: 8 }} accessibilityLiveRegion="polite">{remaining()}</Text>
          )}
        </View>

        <FormError message={error} />
      </View>
    </Sheet>
  );
}

function trimZeros(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}
