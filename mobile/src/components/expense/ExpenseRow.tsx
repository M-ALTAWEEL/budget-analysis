import { Users } from "lucide-react-native";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";

import { useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useColors } from "@/theme/ThemeProvider";
import type { Currency, Expense } from "@/types/api";

/** One expense. Tap to edit. Foreign-currency amounts also show the converted value. */
export function ExpenseRow({ expense, budgetCurrency }: { expense: Expense; budgetCurrency?: Currency }) {
  const openSheet = useExpenseSheet();
  const colors = useColors();
  const converted = budgetCurrency && expense.currency !== budgetCurrency;
  const { t, money, categoryName } = useI18n();

  return (
    <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} layout={LinearTransition.duration(250)}>
      <Pressable
        onPress={() => openSheet(expense)}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 12,
          backgroundColor: pressed ? `${colors.ink}08` : "transparent",
        })}>
        <CategoryIcon category={expense.category} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="semibold" numberOfLines={1}>{expense.description}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text size={14} tone="muted" numberOfLines={1}>{categoryName(expense.category)}</Text>
            {expense.source === "group" && (
              <View accessible accessibilityLabel={t.groups.fromGroup} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text size={14} tone="muted">·</Text>
                <Users size={14} color={colors.muted} />
              </View>
            )}
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text weight="semibold">{money(expense.amount, expense.currency)}</Text>
          {budgetCurrency && converted && <Text size={14} tone="muted">{money(expense.amount_base, budgetCurrency)}</Text>}
        </View>
      </Pressable>
    </Animated.View>
  );
}
