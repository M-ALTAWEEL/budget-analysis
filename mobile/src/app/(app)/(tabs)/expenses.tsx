import { useRouter, type Href } from "expo-router";
import { ChevronRight, FileUp, Repeat } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { CategoryBreakdown } from "@/components/expense/CategoryBreakdown";
import { useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { ExpenseRow } from "@/components/expense/ExpenseRow";
import { PendingExpenses } from "@/components/offline/Offline";
import { MonthSwitcher, useMonth } from "@/components/layout/MonthProvider";
import { Button } from "@/components/ui/Button";
import { List, LoadError, PageLoader, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useExpenses, useRecurring, useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { useColors } from "@/theme/ThemeProvider";

/** The month's expenses: where the money went (tiles open a category), then every expense. */
export default function ExpensesScreen() {
  const { month } = useMonth();
  const expenses = useExpenses(month);
  const summary = useSummary(month);
  const openSheet = useExpenseSheet();
  const colors = useColors();
  const currency = summary.data?.currency;
  const { t, monthName } = useI18n();
  const errorMessage = useErrorMessage();

  return (
    <Screen refreshing={expenses.isRefetching} onRefresh={() => void expenses.refetch()}>
      <View style={{ marginBottom: 40 }}>
        <MonthSwitcher />
      </View>
      <PendingExpenses />
      {expenses.isPending ? (
        <PageLoader />
      ) : expenses.isError ? (
        <LoadError message={errorMessage(expenses.error)} onRetry={() => void expenses.refetch()} />
      ) : expenses.data.length === 0 ? (
        <View style={{ borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, paddingHorizontal: 24, paddingVertical: 40 }}>
          <Text display weight="semibold" size={20}>{t.expenses.empty(monthName(month))}</Text>
          <Text size={15} tone="muted" style={{ marginTop: 4 }}>{t.expenses.emptyHint}</Text>
          {summary.data && (
            <Button style={{ marginTop: 20, alignSelf: "flex-start" }} onPress={() => openSheet()}>{t.expenses.addFirst}</Button>
          )}
        </View>
      ) : (
        <>
          {summary.data && <CategoryBreakdown summary={summary.data} />}
          <RecurringLink />
          <ImportLink />
          <List>
            {expenses.data.map((expense) => (
              <ExpenseRow key={expense.uuid} expense={expense} budgetCurrency={currency} />
            ))}
          </List>
        </>
      )}
    </Screen>
  );
}

/** "4 recurring · 1,250 TRY a month ›": the way to rent, bills and subscriptions (F1). */
function ImportLink() {
  const router = useRouter();
  const colors = useColors();
  const { t, dir } = useI18n();
  return (
    <Pressable
      onPress={() => router.push("/import" as Href)}
      accessibilityRole="link"
      style={({ pressed }) => ({
        marginBottom: 24, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1,
        borderColor: colors.line, backgroundColor: pressed ? `${colors.ink}08` : colors.surface, paddingHorizontal: 20, paddingVertical: 16,
      })}>
      <FileUp size={20} color={colors.pine} />
      <Text weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{t.imports.link}</Text>
      <ChevronRight size={20} color={colors.muted} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
    </Pressable>
  );
}

function RecurringLink() {
  const recurring = useRecurring();
  const router = useRouter();
  const colors = useColors();
  const { t, dir, money } = useI18n();
  const data = recurring.data;
  const label =
    data && data.items.length > 0
      ? t.recurring.summary(data.items.length, money(data.monthly_total, data.currency))
      : t.recurring.title;
  return (
    <Pressable
      onPress={() => router.push("/recurring" as Href)}
      accessibilityRole="link"
      style={({ pressed }) => ({
        marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1,
        borderColor: colors.line, backgroundColor: pressed ? `${colors.ink}08` : colors.surface, paddingHorizontal: 20, paddingVertical: 16,
      })}>
      <Repeat size={20} color={colors.pine} />
      <Text weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{label}</Text>
      <ChevronRight size={20} color={colors.muted} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
    </Pressable>
  );
}
