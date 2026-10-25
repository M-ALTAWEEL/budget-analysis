import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react-native";
import { View } from "react-native";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Card } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { relativeChange, type MonthComparison } from "@/lib/insights";
import { shiftMonth } from "@/lib/month";
import { useColors } from "@/theme/ThemeProvider";
import type { Currency } from "@/types/api";

const SAME = 0.05;
const MAX_ROWS = 5;

function Change({ now, before }: { now: number; before: number }) {
  const { t, percent, dir } = useI18n();
  const colors = useColors();
  const change = relativeChange(now, before);
  if (change === null) return <Text size={14} tone="muted">{t.insights.newThisMonth}</Text>;
  if (Math.abs(change) < SAME)
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Minus size={16} color={colors.muted} />
        <Text size={14} tone="muted">{t.insights.same}</Text>
      </View>
    );
  const up = change > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon size={16} color={up ? colors.berry : colors.pine} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
      <Text size={14} weight="medium" tone={up ? "berry" : "pine"}>
        {up ? t.insights.more(percent(change)) : t.insights.less(percent(-change))}
      </Text>
    </View>
  );
}

function Bar({ value, scale, color, label, muted }: { value: number; scale: number; color: string; label: string; muted?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ height: 8, flex: 1 }}>
        {value > 0 && (
          <View style={{ height: 8, width: `${Math.max((value / scale) * 100, 1)}%`, backgroundColor: color, borderTopEndRadius: 4, borderBottomEndRadius: 4 }} />
        )}
      </View>
      <Text size={12} tone={muted ? "muted" : "ink"} end style={{ width: 96 }}>{label}</Text>
    </View>
  );
}

export function MonthCompare({ comparison, month, currency }: { comparison: MonthComparison; month: string; currency: Currency }) {
  const { t, money, monthName, categoryName } = useI18n();
  const colors = useColors();
  const format = (amount: number) => money(amount, currency);
  const rows = comparison.categories.slice(0, MAX_ROWS);
  const scale = Math.max(...rows.flatMap((row) => [row.now, row.before]), 1);
  const previousName = monthName(shiftMonth(month, -1));
  const grey = `${colors.muted}66`;

  return (
    <Card>
      <Text size={14} tone="muted">{t.insights.compareIntro(comparison.throughDay)}</Text>
      <View style={{ marginTop: 16, flexDirection: "row", gap: 16 }}>
        <View style={{ flex: 1 }}>
          <Text size={14} tone="muted">{monthName(month)}</Text>
          <Text display weight="semibold" size={24}>{format(comparison.now)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text size={14} tone="muted">{t.insights.sameDays(previousName)}</Text>
          <Text display weight="semibold" size={24} tone="muted">{format(comparison.before)}</Text>
        </View>
      </View>
      <View style={{ marginTop: 8 }}>
        <Change now={comparison.now} before={comparison.before} />
      </View>

      {rows.length > 0 && (
        <>
          <View style={{ marginTop: 24, marginBottom: 12, flexDirection: "row", flexWrap: "wrap", columnGap: 20, rowGap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ height: 8, width: 12, borderRadius: 2, backgroundColor: colors.pine }} />
              <Text size={14} tone="muted">{monthName(month)}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ height: 8, width: 12, borderRadius: 2, backgroundColor: grey }} />
              <Text size={14} tone="muted">{t.insights.sameDays(previousName)}</Text>
            </View>
          </View>
          <View style={{ gap: 16 }}>
            {rows.map(({ category, now, before }) => (
              <View key={category.uuid} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <CategoryIcon category={category} size="sm" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <Text weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>{categoryName(category)}</Text>
                    <Change now={now} before={before} />
                  </View>
                  <View style={{ marginTop: 8, gap: 2 }}>
                    <Bar value={now} scale={scale} color={colors.pine} label={format(now)} />
                    <Bar value={before} scale={scale} color={grey} label={format(before)} muted />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </Card>
  );
}
