import { CalendarDays } from "lucide-react-native";
import { View } from "react-native";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { List, Row } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useColors } from "@/theme/ThemeProvider";
import type { Tips } from "@/types/api";

/** 2026-01-05 was a Monday: weekday 0 in the API's numbering. */
function weekdayName(weekday: number, intl: string): string {
  return new Intl.DateTimeFormat(intl, { weekday: "long" }).format(new Date(2026, 0, 5 + weekday));
}

export function TipList({ tips }: { tips: Tips }) {
  const { t, money, locale } = useI18n();
  const colors = useColors();
  const format = (amount: number | string) => money(Number(amount), tips.currency);
  const weekday = tips.busiest_weekday;
  if (tips.repeated.length === 0 && !weekday) return null;

  return (
    <List>
      {tips.repeated.map((item) => (
        <Row key={item.label} style={{ alignItems: "flex-start" }}>
          <CategoryIcon category={item.category} size="sm" />
          <Text size={15} style={{ flex: 1 }}>
            <Text size={15} weight="semibold">{item.label}</Text>
            {": "}
            {t.insights.repeated(item.count, format(item.total), format(Number(item.total) / 2))}
          </Text>
        </Row>
      ))}
      {weekday && (
        <Row style={{ alignItems: "flex-start" }}>
          <View style={{ width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.pineSoft }}>
            <CalendarDays size={16} color={colors.pine} />
          </View>
          <Text size={15} style={{ flex: 1 }}>
            {t.insights.busiestDay(weekdayName(weekday.weekday, LOCALE_INFO[locale].intl), format(weekday.average), format(weekday.usual))}
          </Text>
        </Row>
      )}
    </List>
  );
}
