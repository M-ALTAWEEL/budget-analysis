import { useRouter } from "expo-router";
import { ChevronLeft, TrendingUp } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { LoadError, PageLoader, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useInflation } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { useColors } from "@/theme/ThemeProvider";
import type { InflationView } from "@/types/api";

/** Inflation and currencies (feature F8), like the website's page. */
export default function InflationScreen() {
  const view = useInflation();
  const router = useRouter();
  const colors = useColors();
  const { t, dir } = useI18n();
  const errorMessage = useErrorMessage();

  return (
    <Screen refreshing={view.isRefetching} onRefresh={() => void view.refetch()}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/budget"))} accessibilityRole="button" accessibilityLabel={t.nav.budget} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 12, marginStart: -6 }}>
        <ChevronLeft size={24} color={colors.muted} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
        <Text size={14} weight="semibold" tone="muted">{t.nav.budget}</Text>
      </Pressable>
      <Text display weight="semibold" size={24} accessibilityRole="header">{t.inflation.title}</Text>
      {view.isPending ? (
        <PageLoader />
      ) : view.isError ? (
        <LoadError message={errorMessage(view.error)} onRetry={() => void view.refetch()} />
      ) : (
        <Body data={view.data} />
      )}
    </Screen>
  );
}

function Body({ data }: { data: InflationView }) {
  const { t, money, monthLabel, categoryName } = useI18n();
  const colors = useColors();
  const maxLocal = Math.max(...data.months.map((m) => Number(m.spent)), 1);
  const maxStable = Math.max(...data.months.map((m) => Number(m.spent_stable ?? 0)), 1);
  const card = { borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 16 } as const;

  return (
    <View style={{ gap: 24, marginTop: 4 }}>
      <Text size={15} tone="muted">{t.inflation.intro(data.stable_currency)}</Text>
      {data.months.length === 0 ? (
        <View style={{ borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, padding: 24 }}>
          <Text tone="muted">{t.inflation.empty}</Text>
        </View>
      ) : (
        <>
          {data.change_local !== null && data.change_stable !== null && (
            <View style={{ borderRadius: 16, backgroundColor: colors.pine, padding: 20, gap: 4 }}>
              <Text display weight="semibold" size={17} tone="onPine">{t.inflation.summary(data.change_local, data.change_stable, data.stable_currency)}</Text>
              <Text size={14} tone="onPine" style={{ opacity: 0.85 }}>{t.inflation.explain}</Text>
            </View>
          )}

          <View style={[card, { gap: 14 }]}>
            <Text display weight="semibold" size={18}>{t.inflation.monthsTitle}</Text>
            <View style={{ flexDirection: "row", gap: 16 }}>
              {[{ c: colors.pine, l: t.inflation.local }, { c: colors.marigold, l: t.inflation.stable(data.stable_currency) }].map((k) => (
                <View key={k.l} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: k.c }} />
                  <Text size={12} tone="muted">{k.l}</Text>
                </View>
              ))}
            </View>
            {data.months.map((m) => (
              <View key={m.month} style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <Text size={14} weight="semibold">{monthLabel(m.month)}{m.partial ? ` · ${t.inflation.soFar}` : ""}</Text>
                  <Text size={13} tone="muted">{money(m.spent, m.currency)} · {m.spent_stable !== null ? money(m.spent_stable, data.stable_currency) : t.inflation.noRate}</Text>
                </View>
                <View style={{ height: 8, borderRadius: 999, backgroundColor: colors.pine, width: `${(Number(m.spent) / maxLocal) * 100}%` }} />
                <View style={{ height: 8, borderRadius: 999, backgroundColor: colors.marigold, width: `${(Number(m.spent_stable ?? 0) / maxStable) * 100}%` }} />
              </View>
            ))}
          </View>

          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TrendingUp size={20} color={colors.berry} />
              <Text display weight="semibold" size={18}>{t.inflation.pricesTitle}</Text>
            </View>
            {data.prices.length === 0 ? (
              <Text size={15} tone="muted">{t.inflation.pricesEmpty}</Text>
            ) : (
              <View style={[card, { padding: 0 }]}>
                {data.prices.map((p, i) => (
                  <View key={p.label} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderColor: colors.line }}>
                    <CategoryIcon category={p.category} size="sm" />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text weight="semibold" numberOfLines={1}>{p.label}</Text>
                      <Text size={12} tone="muted">{categoryName(p.category)} · {monthLabel(p.first_month)} – {monthLabel(p.last_month)}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text weight="semibold" tone="berry">+{p.change}%</Text>
                      <Text size={12} tone="muted">{t.inflation.priceLine(money(p.first_price, p.currency), money(p.last_price, p.currency))}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}
