import { useState } from "react";
import { TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Field, FormError } from "@/components/ui/Field";
import { fontFamily } from "@/components/ui/fonts";
import { List, Row } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useSetAllocations, useSetBudget } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { AMOUNT_PATTERN, isValidAmount, toInputAmount } from "@/lib/money";
import { useColors } from "@/theme/ThemeProvider";
import type { BudgetSummary, Category } from "@/types/api";

export function TotalForm({ summary, month }: { summary: BudgetSummary; month: string }) {
  const setBudget = useSetBudget(month);
  const [total, setTotal] = useState(toInputAmount(summary.total_amount));
  const [error, setError] = useState<string | null>(null);
  const { t, monthName } = useI18n();
  const errorMessage = useErrorMessage();

  async function submit() {
    setError(null);
    if (!isValidAmount(total)) return setError(t.setup.invalidAmount);
    try {
      await setBudget.mutateAsync({ total: total.trim() });
      toast.success(t.budget.updated);
    } catch (err) {
      setError(errorMessage(err, { 422: t.budget.belowPlanned }));
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Field
        label={t.budget.totalLabel(monthName(month))}
        keyboardType="decimal-pad"
        suffix={summary.currency}
        value={total}
        onChangeText={(text) => setTotal(text.replace(",", "."))}
      />
      <Button variant="secondary" onPress={submit} loading={setBudget.isPending}>{t.budget.update}</Button>
      <FormError message={error} />
    </View>
  );
}

/** One limit per category. Leaving a field empty means "no limit" for that category. */
export function AllocationEditor({ summary, month, categories }: { summary: BudgetSummary; month: string; categories: Category[] }) {
  const setAllocations = useSetAllocations(month);
  const [limits, setLimits] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      summary.categories
        .filter((row) => row.limit_amount !== null)
        .map((row) => [row.category.uuid, toInputAmount(row.limit_amount as string)]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const { t, money, categoryName, locale, dir } = useI18n();
  const colors = useColors();
  const errorMessage = useErrorMessage();
  const formatMoney = (amount: number) => money(amount, summary.currency);

  const total = Number(summary.total_amount);
  const planned = Object.values(limits).reduce((sum, value) => sum + (AMOUNT_PATTERN.test(value.trim()) ? Number(value) : 0), 0);
  const unplanned = total - planned;

  async function submit() {
    setError(null);
    const entries = Object.entries(limits).filter(([, value]) => value.trim() !== "");
    if (entries.find(([, value]) => !AMOUNT_PATTERN.test(value.trim()))) return setError(t.budget.invalidLimits);
    if (unplanned < 0) return setError(t.budget.limitsTooHigh);
    try {
      await setAllocations.mutateAsync(entries.map(([category_uuid, value]) => ({ category_uuid, limit_amount: value.trim() })));
      toast.success(t.budget.planSaved);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <View>
      <List>
        {categories.map((category) => (
          <Row key={category.uuid}>
            <CategoryIcon category={category} />
            <Text weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{categoryName(category)}</Text>
            <View style={{ width: 150, flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
              <TextInput
                accessibilityLabel={categoryName(category)}
                keyboardType="decimal-pad"
                placeholder={t.common.noLimit}
                placeholderTextColor={`${colors.muted}b3`}
                value={limits[category.uuid] ?? ""}
                onChangeText={(text) => setLimits((current) => ({ ...current, [category.uuid]: text.replace(",", ".") }))}
                style={{
                  flex: 1, minWidth: 0, height: 40, paddingHorizontal: 12, color: colors.ink, fontSize: 15,
                  fontFamily: fontFamily(false, "regular", locale === "ar"), fontVariant: ["tabular-nums"],
                  textAlign: dir === "rtl" ? "left" : "right",
                }}
              />
              <Text size={14} tone="muted" style={{ paddingHorizontal: 10 }}>{summary.currency}</Text>
            </View>
          </Row>
        ))}
      </List>
      <Text size={15} tone={unplanned < 0 ? "berry" : "muted"} style={{ marginTop: 16 }}>
        {t.budget.planned(formatMoney(planned), formatMoney(total))}{" "}
        {unplanned >= 0 ? t.budget.unassigned(formatMoney(unplanned)) : t.budget.overBy(formatMoney(-unplanned))}
      </Text>
      <Button style={{ marginTop: 12 }} onPress={submit} loading={setAllocations.isPending}>{t.budget.savePlan}</Button>
      <View style={{ marginTop: 12 }}><FormError message={error} /></View>
    </View>
  );
}
