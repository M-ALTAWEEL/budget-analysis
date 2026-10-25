import { Tabs, usePathname, useRouter, type Href } from "expo-router";
import {
  LayoutDashboard, MessageCircle, PiggyBank, Plus, ReceiptText, Settings, Target, Users, type LucideIcon,
} from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { useMonth } from "@/components/layout/MonthProvider";
import { Text } from "@/components/ui/Text";
import { useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import type { Messages } from "@/i18n/messages/en";
import { useColors } from "@/theme/ThemeProvider";

// The website's phone tab bar: seven places (Categories is reached from Budget and Settings).
const NAV: { href: Href; match: string; label: (t: Messages) => string; icon: LucideIcon }[] = [
  { href: "/", match: "/", label: (t) => t.nav.overview, icon: LayoutDashboard },
  { href: "/expenses", match: "/expenses", label: (t) => t.nav.expenses, icon: ReceiptText },
  { href: "/budget", match: "/budget", label: (t) => t.nav.budget, icon: Target },
  { href: "/goals", match: "/goals", label: (t) => t.nav.goals, icon: PiggyBank },
  { href: "/groups", match: "/groups", label: (t) => t.nav.groups, icon: Users },
  { href: "/assistant", match: "/assistant", label: (t) => t.nav.assistant, icon: MessageCircle },
  { href: "/settings", match: "/settings", label: (t) => t.nav.settings, icon: Settings },
];
const TAB_HEIGHT = 58;

function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t.nav.main}
      style={{ flexDirection: "row", borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingBottom: insets.bottom }}>
      {NAV.map(({ href, match, label, icon: Icon }) => {
        const active = match === "/" ? pathname === "/" : pathname.startsWith(match);
        return (
          <Pressable
            key={match}
            onPress={() => router.navigate(href)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{ flex: 1, minWidth: 0, height: TAB_HEIGHT, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 2 }}>
            {active && <View style={{ position: "absolute", top: 0, left: 12, right: 12, height: 2, borderRadius: 1, backgroundColor: colors.pine }} />}
            <Icon size={20} color={active ? colors.pine : colors.muted} />
            <Text size={10} weight={active ? "semibold" : "regular"} tone={active ? "pine" : "muted"} numberOfLines={1} style={{ lineHeight: 13 }}>
              {label(t)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Add expense", only on the money screens and only once the month has a budget (else 409). */
function AddExpenseButton() {
  const openSheet = useExpenseSheet();
  const { month } = useMonth();
  const { data: summary } = useSummary(month);
  const pathname = usePathname();
  const { t } = useI18n();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  if (!summary || !["/", "/expenses", "/budget"].includes(pathname)) return null;
  return (
    <Pressable
      onPress={() => openSheet()}
      accessibilityRole="button"
      style={({ pressed }) => ({
        position: "absolute", end: 16, bottom: TAB_HEIGHT + insets.bottom + 16, height: 56, borderRadius: 28,
        flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24,
        backgroundColor: pressed ? colors.pineDark : colors.pine, transform: [{ scale: pressed ? 0.95 : 1 }],
        shadowColor: colors.pine, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
      })}>
      <Plus size={20} color={colors.onPine} />
      <Text weight="semibold" tone="onPine">{t.expenses.add}</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const colors = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={() => <BottomNav />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper }, animation: "fade" }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="expenses" />
        <Tabs.Screen name="budget" />
        <Tabs.Screen name="goals" />
        <Tabs.Screen name="groups" />
        <Tabs.Screen name="assistant" />
        <Tabs.Screen name="settings" />
      </Tabs>
      <AddExpenseButton />
    </View>
  );
}
