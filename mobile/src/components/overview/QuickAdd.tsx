import { useRouter, type Href } from "expo-router";
import { ArrowDownToLine, Plus, Users, Wallet, type LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { Card } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useColors } from "@/theme/ThemeProvider";
import { RADIUS } from "@/theme/tokens";

/** The website's QuickAdd: an expense, income, a group, an import, one tap each. */
export function QuickAdd() {
  const colors = useColors();
  const { t } = useI18n();
  const router = useRouter();
  const openSheet = useExpenseSheet();
  const tiles: { key: string; label: string; Icon: LucideIcon; primary?: boolean; onPress: () => void }[] = [
    { key: "expense", label: t.expenses.add, Icon: Plus, primary: true, onPress: () => openSheet() },
    { key: "income", label: t.income.add, Icon: Wallet, onPress: () => router.push("/income" as Href) },
    { key: "groups", label: t.nav.groups, Icon: Users, onPress: () => router.navigate("/groups") },
    { key: "import", label: t.imports.title, Icon: ArrowDownToLine, onPress: () => router.push("/import" as Href) },
  ];
  return (
    <Card>
      <Text display weight="semibold" size={16} accessibilityRole="header">{t.overview.quickTitle}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {tiles.map(({ key, label, Icon, primary, onPress }) => (
          <Pressable
            key={key}
            onPress={onPress}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexBasis: "45%", flexGrow: 1, minHeight: 84, padding: 14, justifyContent: "space-between", gap: 10,
              borderRadius: RADIUS.tile, borderWidth: 1,
              borderColor: primary ? colors.brand : colors.line,
              backgroundColor: primary ? (pressed ? colors.brandDark : colors.brand) : pressed ? colors.surface : colors.sunken,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}>
            <View
              style={{
                width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center",
                backgroundColor: primary ? "rgba(255, 255, 255, 0.18)" : colors.surface,
                borderWidth: primary ? 0 : 1, borderColor: colors.line,
              }}>
              <Icon size={18} color={primary ? colors.onBrand : colors.brand} />
            </View>
            <Text size={14} weight="semibold" tone={primary ? "onBrand" : "ink"} numberOfLines={2}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}
