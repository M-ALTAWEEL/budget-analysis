import { View } from "react-native";

import { CategoryBreakdown } from "@/components/expense/CategoryBreakdown";
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
