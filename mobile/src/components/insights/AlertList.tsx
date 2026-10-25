import { OctagonAlert, TriangleAlert } from "lucide-react-native";
import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import type { Alert } from "@/lib/insights";
import { useColors } from "@/theme/ThemeProvider";
import type { Currency } from "@/types/api";

/** Each alert = icon + sentence, so the meaning never depends on colour alone. */
export function AlertList({ alerts, currency }: { alerts: Alert[]; currency: Currency }) {
  const { t, money, percent, categoryName } = useI18n();
  const colors = useColors();
  if (alerts.length === 0) return null;

  function sentence(alert: Alert): string {
    switch (alert.kind) {
      case "category-over":
        return t.insights.categoryOver(categoryName(alert.category), money(alert.over, currency));
      case "category-near":
        return t.insights.categoryNear(categoryName(alert.category), percent(alert.spentRatio), money(alert.left, currency));
      case "budget-almost-gone":
        return t.insights.budgetAlmostGone(percent(alert.spentRatio), alert.daysLeft);
    }
  }

  return (
    <View style={{ marginTop: 40 }}>
      <Text display weight="semibold" size={18} accessibilityRole="header" style={{ marginBottom: 12 }}>
        {t.insights.alertsTitle}
      </Text>
      <View style={{ gap: 8 }}>
        {alerts.map((alert) => {
          const critical = alert.severity === "critical";
          const Icon = critical ? OctagonAlert : TriangleAlert;
          return (
            <View
              key={`${alert.kind}-${"category" in alert ? alert.category.uuid : ""}`}
              style={{
                flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 12,
                paddingHorizontal: 16, paddingVertical: 12,
                backgroundColor: critical ? colors.berrySoft : colors.marigoldSoft,
              }}>
              <Icon size={20} color={critical ? colors.berry : colors.marigoldInk} style={{ marginTop: 1 }} />
              <Text size={15} style={{ flex: 1 }}>{sentence(alert)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
