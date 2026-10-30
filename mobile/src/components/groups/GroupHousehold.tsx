import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Home } from "lucide-react-native";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount, toInputAmount } from "@/lib/money";
import { shiftMonth } from "@/lib/month";
import { deleteGroupBudget, getGroupBudget, GROUP_CATEGORIES, setGroupBudget, type GroupDetail } from "@/services/groups";
import { useColors } from "@/theme/ThemeProvider";
import type { GroupBudget } from "@/types/api";

function calendarMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** The flat's shared monthly budget (feature F7), like the website. */
export function GroupHousehold({ group }: { group: GroupDetail }) {
  const { t, money, monthLabel, dir } = useI18n();
  const colors = useColors();
  const [month, setMonth] = useState(calendarMonth());
  const [editing, setEditing] = useState(false);
  const budget = useQuery({ queryKey: ["groups", group.uuid, "budget", month], queryFn: () => getGroupBudget(group.uuid, month) });
  const data = budget.data;
  const m = (amount: string) => money(amount, group.currency);
  const flip = dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined;
  const isLast = month >= shiftMonth(calendarMonth(), 1);

  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Home size={20} color={colors.pine} />
        <Text display weight="semibold" size={18} style={{ flex: 1 }}>{t.household.title}</Text>
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={8} accessibilityRole="button" accessibilityLabel="←">
          <ChevronLeft size={18} color={colors.ink} style={flip} />
        </Pressable>
        <Text size={14} weight="semibold">{monthLabel(month)}</Text>
        <Pressable onPress={() => setMonth(shiftMonth(month, 1))} disabled={isLast} hitSlop={8} accessibilityRole="button" accessibilityLabel="→" style={{ opacity: isLast ? 0.3 : 1 }}>
          <ChevronRight size={18} color={colors.ink} style={flip} />
        </Pressable>
      </View>

      {!data ? (
        <Text size={14} tone="muted">…</Text>
      ) : data.total_amount === null ? (
        <View style={{ gap: 12 }}>
          <Text size={15} tone="muted">{data.can_edit ? t.household.intro : `${t.household.none} ${t.household.onlyAdmins}`}</Text>
          {data.can_edit && (
            <Button small variant="secondary" style={{ alignSelf: "flex-start" }} onPress={() => setEditing(true)}>{t.household.set}</Button>
          )}
        </View>
      ) : (
        <Summary data={data} m={m} onEdit={() => setEditing(true)} />
      )}

      {data && data.paid_by.length > 0 && (
        <View style={{ borderTopWidth: 1, borderColor: colors.line, paddingTop: 10, gap: 4 }}>
          <Text size={14} weight="semibold" tone="muted">{t.household.paidBy}</Text>
          {data.paid_by.map((p, i) => (
            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text size={14} weight={p.me ? "semibold" : "regular"}>{p.name}</Text>
              <Text size={14}>{m(p.paid)}</Text>
            </View>
          ))}
        </View>
      )}

      {editing && data && <HouseholdSheet group={group} month={month} data={data} onClose={() => setEditing(false)} />}
    </View>
  );
}

function Summary({ data, m, onEdit }: { data: GroupBudget; m: (a: string) => string; onEdit: () => void }) {
  const { t } = useI18n();
  const colors = useColors();
  const total = Number(data.total_amount);
  const over = Number(data.remaining) < 0;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text display weight="semibold" size={22} tone={over ? "berry" : "ink"} style={{ flex: 1 }}>
          {over ? t.household.over(m(String(-Number(data.remaining)))) : t.household.left(m(data.remaining!))}
        </Text>
        {data.can_edit && (
          <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button">
            <Text size={14} weight="semibold" tone="pine">{t.household.edit}</Text>
          </Pressable>
        )}
      </View>
      <Text size={14} tone="muted">{t.household.spentOf(m(data.spent), m(data.total_amount!))}</Text>
      <View style={{ height: 8, borderRadius: 999, backgroundColor: colors.line, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${Math.min(total ? Number(data.spent) / total : 0, 1) * 100}%`, borderRadius: 999, backgroundColor: over ? colors.berry : colors.pine }} />
      </View>
      {data.categories.map((row) => {
        const meta = GROUP_CATEGORIES.find((c) => c.slug === row.category) ?? GROUP_CATEGORIES[7];
        const ratio = row.limit ? Number(row.spent) / Number(row.limit) : 0;
        return (
          <View key={row.category} style={{ gap: 6, marginTop: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <CategoryIcon category={meta} size="sm" />
              <Text size={14} weight="semibold" style={{ flex: 1 }}>{t.categories.names[row.category as keyof typeof t.categories.names] ?? row.category}</Text>
              <Text size={14} tone="muted">{row.limit ? t.household.spentOf(m(row.spent), m(row.limit)) : m(row.spent)}</Text>
            </View>
            {row.limit && (
              <View style={{ height: 6, borderRadius: 999, backgroundColor: colors.line, overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${Math.min(ratio, 1) * 100}%`, borderRadius: 999, backgroundColor: ratio > 1 ? colors.berry : ratio > 0.85 ? colors.marigold : colors.pine }} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function HouseholdSheet({ group, month, data, onClose }: { group: GroupDetail; month: string; data: GroupBudget; onClose: () => void }) {
  const { t, monthLabel } = useI18n();
  const colors = useColors();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [total, setTotal] = useState(data.total_amount ? toInputAmount(data.total_amount) : "");
  const [limits, setLimits] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.categories.filter((c) => c.limit).map((c) => [c.category, toInputAmount(c.limit!)])),
  );
  const [error, setError] = useState<string | null>(null);
  const done = () => queryClient.invalidateQueries({ queryKey: ["groups", group.uuid, "budget"] });
  const save = useMutation({
    mutationFn: () => setGroupBudget(group.uuid, month, total.trim(), Object.fromEntries(Object.entries(limits).filter(([, v]) => v.trim() !== ""))),
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => deleteGroupBudget(group.uuid, month), onSuccess: done });

  async function submit() {
    setError(null);
    if (!isValidAmount(total)) return setError(t.expenses.invalidAmount);
    const values = Object.values(limits).filter((v) => v.trim() !== "");
    if (values.some((v) => !isValidAmount(v) && Number(v) !== 0)) return setError(t.budget.invalidLimits);
    if (values.reduce((sum, v) => sum + Number(v), 0) > Number(total)) return setError(t.household.limitsTooHigh);
    try {
      await save.mutateAsync();
      toast.success(t.household.saved);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Sheet
      title={`${t.household.title} · ${monthLabel(month)}`}
      onClose={onClose}
      footer={
        <>
          <Button onPress={submit} loading={save.isPending}>{t.expenses.saveChanges}</Button>
          {data.total_amount !== null && (
            <Button
              variant="danger"
              loading={remove.isPending}
              onPress={async () => {
                await remove.mutateAsync();
                toast.success(t.household.removed);
                onClose();
              }}>
              {t.household.remove}
            </Button>
          )}
        </>
      }>
      <View style={{ gap: 16 }}>
        <Field label={`${t.household.total} (${group.currency})`} keyboardType="decimal-pad" value={total} onChangeText={(v) => setTotal(v.replace(",", "."))} autoFocus />
        <Text size={14} weight="semibold">{t.household.limits}</Text>
        <View style={{ gap: 8 }}>
          {GROUP_CATEGORIES.map((c) => (
            <View key={c.slug} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 8, paddingVertical: 6 }}>
              <CategoryIcon category={c} size="sm" />
              <Text size={14} style={{ flex: 1 }}>{t.categories.names[c.slug as keyof typeof t.categories.names]}</Text>
              <TextInput
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={limits[c.slug] ?? ""}
                onChangeText={(v) => setLimits({ ...limits, [c.slug]: v.replace(",", ".") })}
                style={{ width: 90, textAlign: "right", borderRadius: 8, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 8, paddingVertical: 4, color: colors.ink }}
              />
            </View>
          ))}
        </View>
        <FormError message={error} />
      </View>
    </Sheet>
  );
}
