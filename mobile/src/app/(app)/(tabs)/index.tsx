import { type Href, useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { useCurrentUser } from "@/components/auth/AuthProvider";
import { ExpenseRow } from "@/components/expense/ExpenseRow";
import { PendingSharesBanner } from "@/components/groups/PendingShares";
import { PendingExpenses } from "@/components/offline/Offline";
import { AlertList } from "@/components/insights/AlertList";
import { PaceChart } from "@/components/insights/PaceChart";
import { SpendingYear } from "@/components/insights/SpendingYear";
import { TipList } from "@/components/insights/TipList";
import { MonthSwitcher, useMonth } from "@/components/layout/MonthProvider";
import { useOpenSearch } from "@/components/layout/SearchMenu";
import { BudgetRing } from "@/components/overview/BudgetRing";
import { BudgetSetup } from "@/components/overview/BudgetSetup";
import { BudgetTank, budgetPace } from "@/components/overview/BudgetTank";
import { CategoryBreakdown } from "@/components/overview/CategoryBreakdown";
import { GoalsCard } from "@/components/overview/GoalsCard";
import { QuickAdd } from "@/components/overview/QuickAdd";
import { IconButton } from "@/components/ui/IconButton";
import { Card, List, LoadError, PageLoader, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useDaily, useExpenses, useSummary, useTips, useWrapped } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { findAlerts } from "@/lib/insights";
import { currentMonth, monthProgress, shiftMonth } from "@/lib/month";
import { useColors } from "@/theme/ThemeProvider";
import { RADIUS } from "@/theme/tokens";
import type { BudgetSummary, DailySpending, Expense, Tips } from "@/types/api";

export default function OverviewScreen() {
  const { month } = useMonth();
  const summary = useSummary(month);
  const expenses = useExpenses(month);
  const daily = useDaily(month);
  const tips = useTips(month);
  const user = useCurrentUser();
  const { t } = useI18n();
  const colors = useColors();
  const openSearch = useOpenSearch();
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
      <View style={{ marginBottom: 24, flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text display weight="semibold" size={22} numberOfLines={1} style={{ marginBottom: 6, letterSpacing: -0.4 }}>{greeting}</Text>
          <MonthSwitcher />
        </View>
        <IconButton label={t.search.open} onPress={openSearch}>
          <Search size={20} color={colors.ink} />
        </IconButton>
      </View>

      <PendingSharesBanner />
      <PendingExpenses />
      {month === currentMonth() && <WrappedBanner />}

      {summary.isPending ? (
        <PageLoader />
      ) : summary.isError ? (
        <LoadError message={errorMessage(summary.error)} onRetry={() => void summary.refetch()} />
      ) : summary.data === null ? (
        <BudgetSetup month={month} />
      ) : (
        <Cards summary={summary.data} month={month} daily={daily.data} tips={tips.data} expenses={expenses.data} />
      )}
    </Screen>
  );
}

/** The website's bento grid, one card under the other on a phone. */
function Cards({
  summary, month, daily, tips, expenses,
}: {
  summary: BudgetSummary; month: string; daily: DailySpending | null | undefined;
  tips: Tips | null | undefined; expenses: Expense[] | undefined;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const pace = budgetPace(summary, month, daily?.forecast);
  const alerts = findAlerts(summary, month);
  return (
    <View style={{ gap: 16 }}>
      <Hero>
        <BudgetTank summary={summary} month={month} forecast={daily?.forecast} inverse />
      </Hero>
      <BudgetRing summary={summary} month={month} pace={pace} />
      <QuickAdd />
      {alerts.length > 0 && <AlertList alerts={alerts} currency={summary.currency} />}

      {daily && (
        <Card>
          <CardTitle title={t.insights.paceTitle} />
          <Text size={14} tone="muted" style={{ marginTop: -6 }}>{t.insights.paceIntro}</Text>
          <PaceChart daily={daily} month={month} />
        </Card>
      )}

      {tips && (tips.repeated.length > 0 || tips.busiest_weekday) && (
        <Card>
          <CardTitle title={t.insights.tipsTitle} />
          <TipList tips={tips} plain />
        </Card>
      )}

      <Card>
        <CardTitle title={t.skyline.title} />
        <SpendingYear month={month} />
      </Card>

      <Card>
        <CardTitle title={t.overview.whereItWent} action={{ label: t.overview.planCategories, onPress: () => router.navigate("/budget") }} />
        <CategoryBreakdown summary={summary} plain />
      </Card>

      {expenses && expenses.length > 0 && (
        <Card>
          <CardTitle title={t.overview.latest} action={{ label: t.overview.seeAll, onPress: () => router.navigate("/expenses") }} />
          <List plain>
            {expenses.slice(0, 5).map((expense) => (
              <ExpenseRow key={expense.uuid} expense={expense} budgetCurrency={summary.currency} />
            ))}
          </List>
        </Card>
      )}

      <GoalsCard />
    </View>
  );
}

function CardTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <Text display weight="semibold" size={16} accessibilityRole="header" style={{ flexShrink: 1 }}>{title}</Text>
      {action && (
        <Pressable accessibilityRole="link" onPress={action.onPress} hitSlop={8}>
          <Text size={14} weight="semibold" tone="brand">{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** The first card: what is left, on the brand panel, with the logo's bars and coin ghosted behind. */
function Hero({ children }: { children: ReactNode }) {
  const colors = useColors();
  return (
    <View
      style={{
        overflow: "hidden", borderRadius: RADIUS.card, padding: 24, backgroundColor: colors.panel,
        boxShadow: `0 24px 48px -24px ${colors.panel}b3`,
      }}>
      <View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        style={{ position: "absolute", end: 22, bottom: -18, flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
        {[92, 138, 184].map((height, index) => (
          <View key={height} style={{ width: 46, height, borderRadius: 23, backgroundColor: "rgba(255, 255, 255, 0.1)" }}>
            {index === 2 && (
              <View style={{ position: "absolute", top: -40, start: 11, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.coral, opacity: 0.8 }} />
            )}
          </View>
        ))}
      </View>
      {children}
    </View>
  );
}

/** In the first week of a month: last month's report is ready (feature F4). */
function WrappedBanner() {
  const router = useRouter();
  const colors = useColors();
  const { t, monthLabel } = useI18n();
  const previous = shiftMonth(currentMonth(), -1);
  const early = monthProgress(currentMonth()).dayOfMonth <= 7;
  const report = useWrapped(previous, early);
  if (!early || !report.data) return null;
  return (
    <Pressable
      onPress={() => router.push(`/wrapped?month=${previous}` as Href)}
      accessibilityRole="link"
      style={({ pressed }) => ({
        marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
        borderRadius: RADIUS.card, backgroundColor: colors.brand, paddingHorizontal: 20, paddingVertical: 16, opacity: pressed ? 0.9 : 1,
      })}>
      <Text weight="semibold" tone="onBrand" style={{ flex: 1 }}>{t.wrapped.ready(monthLabel(previous))}</Text>
      <Text size={14} weight="semibold" tone="onBrand">{t.wrapped.see}</Text>
    </Pressable>
  );
}
