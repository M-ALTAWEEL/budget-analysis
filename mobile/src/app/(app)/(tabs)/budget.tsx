import { type Href, useRouter } from "expo-router";
import { ChevronRight, Wallet } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { AllocationEditor, TotalForm } from "@/components/budget/BudgetPlan";
import { MonthSwitcher, useMonth } from "@/components/layout/MonthProvider";
import { BudgetSetup } from "@/components/overview/BudgetSetup";
import { LoadError, PageLoader, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useCategories, useIncome, useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { useColors } from "@/theme/ThemeProvider";

export default function BudgetScreen() {
  const { month } = useMonth();
  const summary = useSummary(month);
  const categories = useCategories();
  const router = useRouter();
  const { t } = useI18n();
  const errorMessage = useErrorMessage();

  return (
    <Screen
      refreshing={summary.isRefetching}
      onRefresh={() => {
        void summary.refetch();
        void categories.refetch();
      }}>
      <View style={{ marginBottom: 24 }}>
        <MonthSwitcher />
      </View>
      <IncomeLink month={month} />
      {summary.isPending || categories.isPending ? (
        <PageLoader />
      ) : summary.isError || categories.isError ? (
        <LoadError
          message={errorMessage(summary.error ?? categories.error)}
          onRetry={() => {
            void summary.refetch();
            void categories.refetch();
          }}
        />
      ) : summary.data === null ? (
        <BudgetSetup month={month} />
      ) : (
        <View style={{ gap: 48 }}>
          <TotalForm key={`${month}-${summary.data.total_amount}`} summary={summary.data} month={month} />
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Text display weight="semibold" size={20} accessibilityRole="header" style={{ flexShrink: 1 }}>{t.budget.limitsTitle}</Text>
              <Pressable onPress={() => router.push("/categories")} accessibilityRole="link" hitSlop={8}>
                <Text size={14} weight="semibold" tone="pine">{t.settings.manageCategories}</Text>
              </Pressable>
            </View>
            <Text size={15} tone="muted" style={{ marginTop: 4, marginBottom: 16 }}>{t.budget.limitsIntro}</Text>
            <AllocationEditor key={month} summary={summary.data} month={month} categories={categories.data} />
          </View>
        </View>
      )}
    </Screen>
  );
}

/** The way to the month's income (feature F3), with what came in. */
function IncomeLink({ month }: { month: string }) {
  const income = useIncome(month);
  const router = useRouter();
  const colors = useColors();
  const { t, dir, money } = useI18n();
  const data = income.data;
  const label = data && data.items.length > 0 ? t.income.summary(money(data.total, data.currency)) : t.income.title;
  return (
    <Pressable
      onPress={() => router.push("/income" as Href)}
      accessibilityRole="link"
      style={({ pressed }) => ({
        marginBottom: 32, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1,
        borderColor: colors.line, backgroundColor: pressed ? `${colors.ink}08` : colors.surface, paddingHorizontal: 20, paddingVertical: 16,
      })}>
      <Wallet size={20} color={colors.pine} />
      <Text weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{label}</Text>
      <ChevronRight size={20} color={colors.muted} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
    </Pressable>
  );
}
