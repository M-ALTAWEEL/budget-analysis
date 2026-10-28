import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { ExpenseRow } from "@/components/expense/ExpenseRow";
import { MonthSwitcher, useMonth } from "@/components/layout/MonthProvider";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { List, LoadError, PageLoader, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useCategories, useExpenses, useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { categoryShares, shareLabel } from "@/lib/insights";
import { useColors } from "@/theme/ThemeProvider";

/** One category's month (opened from a tile on Expenses): how much went on it, and its expenses. */
export default function CategoryExpensesScreen() {
  const { uuid = "" } = useLocalSearchParams<{ uuid?: string }>();
  const { month } = useMonth();
  const expenses = useExpenses(month);
  const summary = useSummary(month);
  const categories = useCategories();
  const router = useRouter();
  const colors = useColors();
  const { t, dir, money, percent, monthName, categoryName } = useI18n();
  const errorMessage = useErrorMessage();

  const shown = expenses.data?.filter((e) => e.category.uuid === uuid) ?? [];
  const category = categories.data?.find((c) => c.uuid === uuid) ?? shown[0]?.category ?? null;
  const share = summary.data ? categoryShares(summary.data).find((s) => s.category.uuid === uuid) : undefined;
  const currency = summary.data?.currency;

  return (
    <Screen refreshing={expenses.isRefetching} onRefresh={() => void expenses.refetch()}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/expenses"))} accessibilityRole="button" accessibilityLabel={t.expenses.allExpenses} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 12, marginStart: -6 }}>
        <ChevronLeft size={24} color={colors.muted} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
        <Text size={14} weight="semibold" tone="muted">{t.expenses.allExpenses}</Text>
      </Pressable>
      <View style={{ marginBottom: 24 }}>
        <MonthSwitcher />
      </View>

      <View style={{ marginBottom: 24, alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 24, paddingVertical: 28 }}>
        {category && <CategoryIcon category={category} />}
        <Text tone="muted" accessibilityRole="header" style={{ textAlign: "center" }}>
          {t.expenses.categoryTotal(category ? categoryName(category) : "", monthName(month))}
        </Text>
        {currency && <Text display weight="semibold" size={30}>{money(share?.spent ?? 0, currency)}</Text>}
        {share && <Text size={14} tone="muted">{t.expenses.ofMonth(shareLabel(share.share, percent))}</Text>}
      </View>

      {expenses.isPending ? (
        <PageLoader />
      ) : expenses.isError ? (
        <LoadError message={errorMessage(expenses.error)} onRetry={() => void expenses.refetch()} />
      ) : shown.length === 0 ? (
        <Text size={15} tone="muted" style={{ borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, paddingHorizontal: 20, paddingVertical: 24 }}>
          {t.expenses.categoryEmpty}
        </Text>
      ) : (
        <List>
          {shown.map((expense) => (
            <ExpenseRow key={expense.uuid} expense={expense} budgetCurrency={currency} />
          ))}
        </List>
      )}
    </Screen>
  );
}
