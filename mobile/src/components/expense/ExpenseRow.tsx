import { Repeat, Users } from "lucide-react-native";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";

import { useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Text } from "@/components/ui/Text";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { expenseWhen } from "@/lib/month";
import { useColors } from "@/theme/ThemeProvider";
import type { Currency, Expense } from "@/types/api";

/**
 * One expense, as a bank statement shows it: when, what, the category, and the amount.
 * Tap to edit. Foreign-currency amounts also show the converted value.
 */
export function ExpenseRow({ expense, budgetCurrency }: { expense: Expense; budgetCurrency?: Currency }) {
  const openSheet = useExpenseSheet();
  const colors = useColors();
  const converted = budgetCurrency && expense.currency !== budgetCurrency;
  const { t, locale, money, categoryName } = useI18n();

  return (
    <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} layout={LinearTransition.duration(250)}>
      <Pressable
        onPress={() => openSheet(expense)}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 14,
          backgroundColor: pressed ? `${colors.ink}08` : "transparent",
        })}>
        <CategoryIcon category={expense.category} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={12} tone="muted">{expenseWhen(expense.spent_at, expense.created_at, LOCALE_INFO[locale].intl)}</Text>
          <Text weight="semibold" numberOfLines={1}>{expense.description}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text size={14} tone="muted" numberOfLines={1}>{categoryName(expense.category)}</Text>
            {expense.source === "group" && (
              <View accessible accessibilityLabel={t.groups.fromGroup} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text size={14} tone="muted">·</Text>
                <Users size={14} color={colors.muted} />
              </View>
            )}
            {expense.source === "recurring" && (
              <View accessible accessibilityLabel={t.recurring.open} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text size={14} tone="muted">·</Text>
                <Repeat size={14} color={colors.muted} />
              </View>
            )}
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text weight="semibold" size={18}>{money(expense.amount, expense.currency)}</Text>
          {budgetCurrency && converted && <Text size={14} tone="muted">{money(expense.amount_base, budgetCurrency)}</Text>}
        </View>
      </Pressable>
    </Animated.View>
  );
}
