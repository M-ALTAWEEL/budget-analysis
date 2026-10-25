import { useRouter } from "expo-router";
import { View } from "react-native";

import { useCurrentUser } from "@/components/auth/AuthProvider";
import { ExpenseRow } from "@/components/expense/ExpenseRow";
import { PendingSharesBanner } from "@/components/groups/PendingShares";
import { AlertList } from "@/components/insights/AlertList";
import { MonthCompare } from "@/components/insights/MonthCompare";
import { PaceChart } from "@/components/insights/PaceChart";
import { TipList } from "@/components/insights/TipList";
import { MonthSwitcher, useMonth } from "@/components/layout/MonthProvider";
import { BudgetSetup } from "@/components/overview/BudgetSetup";
import { BudgetTank } from "@/components/overview/BudgetTank";
import { CategoryBreakdown } from "@/components/overview/CategoryBreakdown";
import { List, LoadError, PageLoader, Screen, Section } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useDaily, useExpenses, useSummary, useTips } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { compareWithPrevious, daysElapsed, findAlerts } from "@/lib/insights";
import { shiftMonth } from "@/lib/month";
import { useColors } from "@/theme/ThemeProvider";
import type { DailySpending } from "@/types/api";

export default function OverviewScreen() {
  const { month } = useMonth();
  const summary = useSummary(month);
  const expenses = useExpenses(month);
  const daily = useDaily(month);
  const previousDaily = useDaily(shiftMonth(month, -1));
  const tips = useTips(month);
  const user = useCurrentUser();
  const router = useRouter();
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const hour = new Date().getHours();
  const firstName = user.full_name.split(" ")[0];
  const greeting = hour < 12 ? t.overview.morning(firstName) : hour < 18 ? t.overview.afternoon(firstName) : t.overview.evening(firstName);
  const refreshing = summary.isRefetching || expenses.isRefetching || daily.isRefetching;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        void summary.refetch();
        void expenses.refetch();
        void daily.refetch();
        void tips.refetch();
      }}>
      <View style={{ marginBottom: 40 }}>
        <Text size={15} tone="muted" style={{ marginBottom: 4 }}>{greeting}</Text>
        <MonthSwitcher />
      </View>

      <PendingSharesBanner />

      {summary.isPending ? (
        <PageLoader />
      ) : summary.isError ? (
        <LoadError message={errorMessage(summary.error)} onRetry={() => void summary.refetch()} />
      ) : summary.data === null ? (
        <BudgetSetup month={month} />
      ) : (
        <>
          <BudgetTank summary={summary.data} month={month} forecast={daily.data?.forecast} />
          <AlertList alerts={findAlerts(summary.data, month)} currency={summary.data.currency} />

          {daily.data && (
            <Section title={t.insights.paceTitle} style={{ marginTop: 56 }}>
              <Text size={15} tone="muted" style={{ marginTop: -6, marginBottom: 16 }}>{t.insights.paceIntro}</Text>
              <PaceChart daily={daily.data} month={month} />
            </Section>
          )}

          {tips.data && (tips.data.repeated.length > 0 || tips.data.busiest_weekday) && (
            <Section title={t.insights.tipsTitle} style={{ marginTop: 56 }}>
              <TipList tips={tips.data} />
            </Section>
          )}

          {daily.data && previousDaily.isSuccess && daysElapsed(month) > 0 && (
            <Section title={t.insights.compareTitle} style={{ marginTop: 56 }}>
              <Comparison current={daily.data} previous={previousDaily.data} month={month} />
            </Section>
          )}

          <Section
            title={t.overview.whereItWent}
            style={{ marginTop: 56 }}
            action={{ label: t.overview.planCategories, onPress: () => router.navigate("/budget") }}>
            <CategoryBreakdown summary={summary.data} />
          </Section>

          {expenses.data && expenses.data.length > 0 && (
            <Section
              title={t.overview.latest}
              style={{ marginTop: 56 }}
              action={{ label: t.overview.seeAll, onPress: () => router.navigate("/expenses") }}>
              <List>
                {expenses.data.slice(0, 5).map((expense) => (
                  <ExpenseRow key={expense.uuid} expense={expense} budgetCurrency={summary.data?.currency} />
                ))}
              </List>
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}

function Comparison({ current, previous, month }: { current: DailySpending; previous: DailySpending | null; month: string }) {
  const { t } = useI18n();
  const colors = useColors();
  const comparison = compareWithPrevious(current, previous, month);
  if (comparison) return <MonthCompare comparison={comparison} month={month} currency={current.currency} />;
  const reason = previous && previous.currency !== current.currency ? t.insights.differentCurrency : t.insights.noComparison;
  return (
    <Text size={15} tone="muted" style={{ borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, paddingHorizontal: 20, paddingVertical: 24 }}>
      {reason}
    </Text>
  );
}
