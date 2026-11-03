import { Tabs, usePathname, useRouter, type Href } from "expo-router";
import { MoreHorizontal, Plus, Search } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { useMonth } from "@/components/layout/MonthProvider";
import { useKeyboardOpen } from "@/components/layout/dock";
import { PLACE_ICONS } from "@/components/layout/placeIcons";
import { SearchProvider, useOpenSearch } from "@/components/layout/SearchMenu";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { appPath, DOCK_PLACES, MORE_PLACES, PLACES, type Place, type PlaceId } from "@/lib/commands";
import { useTheme } from "@/theme/ThemeProvider";
import { elevation, RADIUS } from "@/theme/tokens";

const byId = (id: PlaceId) => PLACES.find((place) => place.id === id) as Place;
const isActive = (pathname: string, place: Place) =>
  place.id === "overview" ? pathname === "/" : pathname.startsWith(appPath(place));

/** "+": the expense form, or Overview's budget setup while the month has no budget (else 409). */
function useAddExpense() {
  const openSheet = useExpenseSheet();
  const { month } = useMonth();
  const { data: summary } = useSummary(month);
  const router = useRouter();
  return () => (summary ? openSheet() : router.navigate("/"));
}

/**
 * The website's phone dock: three places, the "+" in the middle, and More. It floats over
 * the page, solid white with a soft shadow (no blur: that would need a new native module).
 */
function Dock() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const add = useAddExpense();
  const [more, setMore] = useState(false);
  const inMore = MORE_PLACES.some((id) => isActive(pathname, byId(id)));
  const [first, second, third] = DOCK_PLACES.map(byId);
  const typing = useKeyboardOpen();

  return (
    <>
      {!typing && <View
        accessibilityRole="tablist"
        accessibilityLabel={t.nav.main}
        style={{
          position: "absolute", start: 12, end: 12, bottom: insets.bottom + 12,
          flexDirection: "row", alignItems: "center", justifyContent: "space-around", padding: 8,
          borderRadius: 26, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
          boxShadow: elevation(dark).float,
        }}>
        <DockTab place={first} active={isActive(pathname, first)} />
        <DockTab place={second} active={isActive(pathname, second)} />
        <Pressable
          onPress={add}
          accessibilityRole="button"
          accessibilityLabel={t.expenses.add}
          style={({ pressed }) => ({
            width: 54, height: 54, marginTop: -22, borderRadius: 18, alignItems: "center", justifyContent: "center",
            backgroundColor: pressed ? colors.brandDark : colors.brand, transform: [{ scale: pressed ? 0.92 : 1 }],
            boxShadow: `0 12px 24px -10px ${colors.brand}`,
          })}>
          <Plus size={24} strokeWidth={2.2} color={colors.onBrand} />
        </Pressable>
        <DockTab place={third} active={isActive(pathname, third)} />
        <DockButton
          label={t.nav.more}
          active={inMore}
          onPress={() => setMore(true)}
          icon={(color) => <MoreHorizontal size={20} color={color} />}
        />
      </View>}
      {more && <MoreSheet onClose={() => setMore(false)} />}
    </>
  );
}

function DockTab({ place, active }: { place: Place; active: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const Icon = PLACE_ICONS[place.id];
  return (
    <DockButton
      label={place.label(t)}
      active={active}
      tab
      onPress={() => router.navigate(appPath(place) as Href)}
      icon={(color) => <Icon size={20} color={color} />}
    />
  );
}

function DockButton({
  label, active, tab, onPress, icon,
}: {
  label: string; active: boolean; tab?: boolean; onPress: () => void; icon: (color: string) => React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={tab ? "tab" : "button"}
      accessibilityState={tab ? { selected: active } : undefined}
      style={{ width: 64, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: RADIUS.control }}>
      {icon(active ? colors.brand : colors.muted)}
      <Text size={11} weight={active ? "semibold" : "regular"} tone={active ? "brand" : "muted"} numberOfLines={1} style={{ lineHeight: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The other main places as large tiles, and search for everything else. */
function MoreSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const openSearch = useOpenSearch();
  const tiles = [
    ...MORE_PLACES.map(byId).map((place) => ({
      key: place.id,
      label: place.label(t),
      Icon: PLACE_ICONS[place.id],
      active: isActive(pathname, place),
      onPress: () => router.navigate(appPath(place) as Href),
    })),
    { key: "search", label: t.search.open, Icon: Search, active: false, onPress: openSearch },
  ];
  return (
    <Sheet title={t.nav.more} onClose={onClose}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {tiles.map(({ key, label, Icon, active, onPress }) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              onClose();
              onPress();
            }}
            style={({ pressed }) => ({
              flexBasis: "30%", flexGrow: 1, minHeight: 88, padding: 14, justifyContent: "space-between", gap: 8,
              borderRadius: RADIUS.tile, borderWidth: 1,
              borderColor: active ? colors.brand : colors.line,
              backgroundColor: active ? colors.brandSoft : colors.sunken,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}>
            <View style={{ width: 34, height: 34, borderRadius: 11, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
              <Icon size={18} color={colors.brand} />
            </View>
            <Text size={14} weight="semibold" tone={active ? "brand" : "ink"} numberOfLines={1}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <SearchProvider>
      <Tabs
        tabBar={() => <Dock />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper }, animation: "fade" }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="expenses" />
        <Tabs.Screen name="budget" />
        <Tabs.Screen name="goals" />
        <Tabs.Screen name="groups" />
        <Tabs.Screen name="assistant" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </SearchProvider>
  );
}
