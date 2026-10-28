import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { categoryShares, shareLabel } from "@/lib/insights";
import { useColors } from "@/theme/ThemeProvider";
import type { BudgetSummary } from "@/types/api";

/** Where the month's money went: one bar split by category, then a tile per category (like the website). */
export function CategoryBreakdown({ summary }: { summary: BudgetSummary }) {
  const { t, money, percent, categoryName } = useI18n();
  const colors = useColors();
  const router = useRouter();
  const shares = categoryShares(summary);
  if (shares.length === 0) return null;

  return (
    <View style={{ marginBottom: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingVertical: 20 }}>
      <Text weight="semibold" accessibilityRole="header" style={{ marginBottom: 16, paddingHorizontal: 20 }}>{t.expenses.byCategory}</Text>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", height: 12, gap: 2, borderRadius: 999, overflow: "hidden", marginHorizontal: 20 }}>
        {shares.map(({ category, share }) => (
          <View key={category.uuid} style={{ flexGrow: share, flexBasis: 0, backgroundColor: category.color }} />
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20, marginTop: 20 }}>
        {shares.map(({ category, spent, share }) => (
          <Pressable
            key={category.uuid}
            onPress={() => router.push({ pathname: "/expenses-category", params: { uuid: category.uuid } })}
            accessibilityRole="button"
            accessibilityLabel={`${categoryName(category)}, ${shareLabel(share, percent)}, ${money(spent, summary.currency)}`}
            style={({ pressed }) => ({
              width: 96, alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.line,
              paddingHorizontal: 8, paddingVertical: 12, backgroundColor: pressed ? `${colors.ink}08` : "transparent",
            })}>
            <Text size={14} tone="muted" numberOfLines={1}>{categoryName(category)}</Text>
            <CategoryIcon category={category} />
            <Text weight="semibold" size={18}>{shareLabel(share, percent)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
