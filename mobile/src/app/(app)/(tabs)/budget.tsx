import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { AllocationEditor, TotalForm } from "@/components/budget/BudgetPlan";
import { MonthSwitcher, useMonth } from "@/components/layout/MonthProvider";
import { BudgetSetup } from "@/components/overview/BudgetSetup";
import { LoadError, PageLoader, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useCategories, useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";

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
      <View style={{ marginBottom: 40 }}>
        <MonthSwitcher />
      </View>
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
