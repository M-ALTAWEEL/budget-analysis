import { View } from "react-native";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Empty, List, Row } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useColors } from "@/theme/ThemeProvider";
import type { BudgetSummary } from "@/types/api";

export function CategoryBreakdown({ summary }: { summary: BudgetSummary }) {
  const { t, money, categoryName } = useI18n();
  const colors = useColors();
  const format = (amount: string | number) => money(amount, summary.currency);
  if (summary.categories.length === 0) return <Empty text={t.overview.nothingSpent} />;

  return (
    <List>
      {summary.categories.map(({ category, limit_amount, spent }) => {
        const limit = limit_amount === null ? null : Number(limit_amount);
        const ratio = limit ? Number(spent) / limit : null;
        const bar = ratio === null ? colors.pine : ratio > 1 ? colors.berry : ratio > 0.85 ? colors.marigold : colors.pine;
        return (
          <Row key={category.uuid}>
            <CategoryIcon category={category} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>{categoryName(category)}</Text>
                <Text size={15}>
                  {format(spent)}
                  {limit !== null && <Text size={15} tone="muted"> {t.tank.of(format(limit))}</Text>}
                </Text>
              </View>
              {ratio !== null && limit !== null ? (
                <>
                  <View style={{ marginTop: 8, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: colors.pineSoft }}>
                    <View style={{ height: 6, borderRadius: 3, width: `${Math.min(ratio, 1) * 100}%`, backgroundColor: bar }} />
                  </View>
                  {ratio > 0.85 && (
                    <Text size={14} tone={ratio > 1 ? "berry" : "muted"} weight={ratio > 1 ? "medium" : "regular"} style={{ marginTop: 4 }}>
                      {ratio > 1
                        ? t.overview.overLimit(format(Number(spent) - limit))
                        : t.overview.onlyLeft(format(limit - Number(spent)))}
                    </Text>
                  )}
                </>
              ) : (
                <Text size={14} tone="muted" style={{ marginTop: 2 }}>{t.overview.noLimitSet}</Text>
              )}
            </View>
          </Row>
        );
      })}
    </List>
  );
}
