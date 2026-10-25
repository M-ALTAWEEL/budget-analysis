import { View } from "react-native";

import { useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { ExpenseRow } from "@/components/expense/ExpenseRow";
import { MonthSwitcher, useMonth } from "@/components/layout/MonthProvider";
import { Button } from "@/components/ui/Button";
import { List, LoadError, PageLoader, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useExpenses, useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { useColors } from "@/theme/ThemeProvider";
import type { Expense } from "@/types/api";

/** Expenses are already sorted newest first; group consecutive ones by day. */
function groupByDay(expenses: Expense[]) {
  const groups: { day: string; items: Expense[] }[] = [];
  for (const expense of expenses) {
    const last = groups.at(-1);
    if (last?.day === expense.spent_at) last.items.push(expense);
    else groups.push({ day: expense.spent_at, items: [expense] });
  }
  return groups;
}

export default function ExpensesScreen() {
  const { month } = useMonth();
  const expenses = useExpenses(month);
  const summary = useSummary(month);
  const openSheet = useExpenseSheet();
  const colors = useColors();
  const currency = summary.data?.currency;
  const { t, money, monthName, dayLabel } = useI18n();
  const errorMessage = useErrorMessage();

  return (
    <Screen refreshing={expenses.isRefetching} onRefresh={() => void expenses.refetch()}>
      <View style={{ marginBottom: 40 }}>
        <MonthSwitcher />
      </View>
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
        <View style={{ gap: 32 }}>
          {groupByDay(expenses.data).map(({ day, items }) => {
            const dayTotal = items.reduce((sum, item) => sum + Number(item.amount_base), 0);
            return (
              <View key={day} accessibilityLabel={dayLabel(day)}>
                <View style={{ marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 }}>
                  <Text weight="semibold" accessibilityRole="header">{dayLabel(day)}</Text>
                  {currency && <Text size={14} tone="muted">{money(dayTotal, currency)}</Text>}
                </View>
                <List>
                  {items.map((expense) => (
                    <ExpenseRow key={expense.uuid} expense={expense} budgetCurrency={currency} />
                  ))}
                </List>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
