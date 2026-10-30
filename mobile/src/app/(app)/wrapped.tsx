import { isAxiosError } from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, Share2, TrendingDown, TrendingUp } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Share, View } from "react-native";

import { DownloadReport } from "@/components/reports/DownloadReport";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { LoadError, PageLoader, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useWrapped } from "@/hooks/queries";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { currentMonth, shiftMonth, weekdayName } from "@/lib/month";
import { useColors } from "@/theme/ThemeProvider";
import type { Wrapped } from "@/types/api";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The month-end report (feature F4), like the website's page. */
export default function WrappedScreen() {
  const params = useLocalSearchParams<{ month?: string }>();
  const router = useRouter();
  const colors = useColors();
  const { t, dir, monthLabel } = useI18n();
  const errorMessage = useErrorMessage();
  const month = params.month && MONTH.test(params.month) ? params.month : shiftMonth(currentMonth(), -1);
  const report = useWrapped(month);
  const notFound = report.isError && isAxiosError(report.error) && report.error.response?.status === 404;
  const flip = dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined;
  const go = (delta: number) => router.setParams({ month: shiftMonth(month, delta) });
  const isLast = month >= currentMonth();

  return (
    <Screen refreshing={report.isRefetching} onRefresh={() => void report.refetch()}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/budget"))} accessibilityRole="button" accessibilityLabel={t.nav.budget} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 12, marginStart: -6 }}>
        <ChevronLeft size={24} color={colors.muted} style={flip} />
        <Text size={14} weight="semibold" tone="muted">{t.nav.budget}</Text>
      </Pressable>
      <View style={{ marginBottom: 24, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text size={14} weight="semibold" tone="pine">{t.wrapped.title}</Text>
          <Text display weight="semibold" size={28} accessibilityRole="header">{t.wrapped.heading(monthLabel(month))}</Text>
        </View>
        <Pressable onPress={() => go(-1)} accessibilityRole="button" accessibilityLabel="←" hitSlop={8} style={{ padding: 6 }}>
          <ChevronLeft size={22} color={colors.ink} style={flip} />
        </Pressable>
        <Pressable onPress={() => go(1)} disabled={isLast} accessibilityRole="button" accessibilityLabel="→" hitSlop={8} style={{ padding: 6, opacity: isLast ? 0.3 : 1 }}>
          <ChevronRight size={22} color={colors.ink} style={flip} />
        </Pressable>
      </View>

      {report.isPending ? (
        <PageLoader />
      ) : notFound ? (
        <View style={{ borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, padding: 24 }}>
          <Text tone="muted">{t.wrapped.noBudget}</Text>
        </View>
      ) : report.isError ? (
        <LoadError message={errorMessage(report.error)} onRetry={() => void report.refetch()} />
      ) : (
        <Report data={report.data} />
      )}
    </Screen>
  );
}

function Card({ title, children, pine = false }: { title?: string; children: ReactNode; pine?: boolean }) {
  const colors = useColors();
  return (
    <View style={{ borderRadius: 24, borderWidth: pine ? 0 : 1, borderColor: colors.line, backgroundColor: pine ? colors.pine : colors.surface, padding: 20 }}>
      {title && <Text size={13} weight="semibold" tone="muted" style={{ marginBottom: 14 }}>{title.toUpperCase()}</Text>}
      {children}
    </View>
  );
}

function Report({ data }: { data: Wrapped }) {
  const { t, money, monthLabel, locale, categoryName, shortDate } = useI18n();
  const colors = useColors();
  const m = (amount: string) => money(amount, data.currency);
  const over = Number(data.saved) < 0;
  const used = Number(data.budget) > 0 ? Math.min(Number(data.spent) / Number(data.budget), 1) : 0;
  const change = data.change_percent;
  const lines = [
    t.wrapped.expenses(data.expense_count),
    t.wrapped.noSpendDays(data.no_spend_days),
    t.wrapped.dailyAverage(m(data.daily_average)),
    data.busiest_weekday !== null ? t.wrapped.busiest(weekdayName(data.busiest_weekday, LOCALE_INFO[locale].intl)) : null,
    data.income !== null ? t.wrapped.income(m(data.income)) : null,
    Number(data.goals_saved) > 0 ? t.wrapped.goalsSaved(m(data.goals_saved)) : null,
  ].filter((line): line is string => line !== null);

  return (
    <View style={{ gap: 16 }}>
      <Card pine>
        {!data.finished && <Text size={14} tone="onPine" style={{ marginBottom: 8, opacity: 0.8 }}>{t.wrapped.soFar}</Text>}
        <Text display weight="semibold" size={22} tone="onPine">{t.wrapped.spentOf(m(data.spent), m(data.budget))}</Text>
        <View style={{ marginTop: 18, height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
          <View style={{ height: "100%", width: `${used * 100}%`, borderRadius: 999, backgroundColor: colors.onPine }} />
        </View>
        <Text weight="semibold" size={18} tone="onPine" style={{ marginTop: 12 }}>
          {over ? t.wrapped.overspent(m(String(-Number(data.saved)))) : t.wrapped.leftOver(m(data.saved))}
        </Text>
        {change !== null && (
          <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
            {change > 0 ? <TrendingUp size={16} color={colors.onPine} /> : <TrendingDown size={16} color={colors.onPine} />}
            <Text size={15} tone="onPine">
              {Math.abs(change) < 3 ? t.wrapped.same : change > 0 ? t.wrapped.more(change) : t.wrapped.less(-change)}
            </Text>
          </View>
        )}
      </Card>

      {data.top_categories.length > 0 && (
        <Card title={t.wrapped.topTitle}>
          <View style={{ gap: 16 }}>
            {data.top_categories.map((row) => (
              <View key={row.category.uuid} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <CategoryIcon category={row.category} size="sm" />
                  <Text weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{categoryName(row.category)}</Text>
                  <Text size={14} tone="muted">{row.share}%</Text>
                  <Text weight="semibold">{m(row.spent)}</Text>
                </View>
                <View style={{ height: 6, borderRadius: 999, backgroundColor: colors.line, overflow: "hidden" }}>
                  <View style={{ height: "100%", width: `${row.share}%`, borderRadius: 999, backgroundColor: row.category.color }} />
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      {data.biggest && (
        <Card title={t.wrapped.biggestTitle}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <CategoryIcon category={data.biggest.category} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text weight="semibold" numberOfLines={1}>{data.biggest.description}</Text>
              <Text size={14} tone="muted">{shortDate(data.biggest.spent_at)}</Text>
            </View>
            <Text display weight="semibold" size={20}>{m(data.biggest.amount)}</Text>
          </View>
        </Card>
      )}

      <Card title={t.wrapped.numbersTitle}>
        <View style={{ gap: 10 }}>
          {lines.map((line) => (
            <Text key={line} size={15}>{line}</Text>
          ))}
        </View>
      </Card>

      <DownloadReport month={data.month} />

      <Button
        variant="secondary"
        style={{ alignSelf: "flex-start" }}
        icon={<Share2 size={16} color={colors.ink} />}
        onPress={() => void Share.share({ message: t.wrapped.shareText(monthLabel(data.month), m(data.spent), m(data.budget)) }).catch(() => undefined)}>
        {t.wrapped.share}
      </Button>
    </View>
  );
}
