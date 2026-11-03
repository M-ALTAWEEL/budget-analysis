import { useRouter, type Href } from "expo-router";
import { Moon, Plus, Search, Sun } from "lucide-react-native";
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";
import { Pressable, TextInput, View } from "react-native";

import { useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { useMonth } from "@/components/layout/MonthProvider";
import { PLACE_ICONS } from "@/components/layout/placeIcons";
import { fontFamily } from "@/components/ui/fonts";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { appPath, searchCommands, type Command } from "@/lib/commands";
import { useTheme } from "@/theme/ThemeProvider";
import { RADIUS } from "@/theme/tokens";

const SearchContext = createContext<(() => void) | null>(null);

/** Opens the search sheet (the Overview's search button, the More sheet). */
export function useOpenSearch() {
  const open = use(SearchContext);
  if (!open) throw new Error("useOpenSearch must be used inside <SearchProvider>");
  return open;
}

/**
 * The website's search menu as a sheet: typing filters the actions and places
 * (lib/commands.ts, the same list as the website); a tap runs one.
 */
export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  return (
    <SearchContext value={show}>
      {children}
      {open && <SearchSheet onClose={() => setOpen(false)} />}
    </SearchContext>
  );
}

function SearchSheet({ onClose }: { onClose: () => void }) {
  const { t, dir, locale } = useI18n();
  const { colors, dark, setPreference } = useTheme();
  const router = useRouter();
  const openSheet = useExpenseSheet();
  const { month } = useMonth();
  const { data: summary } = useSummary(month);
  const [query, setQuery] = useState("");
  const commands = useMemo(() => searchCommands(query, t, dark), [query, t, dark]);

  function run(command: Command) {
    onClose();
    if (command.kind === "place") router.navigate(appPath(command.place) as Href);
    else if (command.id === "toggleTheme") setPreference(dark ? "light" : "dark");
    // Expenses need a budget for their month: without one, Overview shows how to set it up.
    else if (summary) openSheet();
    else router.navigate("/");
  }

  return (
    <Sheet title={t.search.open} onClose={onClose}>
      <View
        style={{
          flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12, paddingHorizontal: 12,
          borderRadius: RADIUS.control, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.sunken,
        }}>
        <Search size={18} color={colors.muted} />
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder={t.search.placeholder}
          placeholderTextColor={colors.muted}
          accessibilityLabel={t.search.open}
          returnKeyType="go"
          onSubmitEditing={() => commands[0] && run(commands[0])}
          style={{
            flex: 1, minHeight: 46, fontSize: 15, color: colors.ink,
            fontFamily: fontFamily(false, "regular", locale === "ar"),
            textAlign: dir === "rtl" ? "right" : "left", writingDirection: dir,
          }}
        />
      </View>
      {commands.length === 0 ? (
        <Text tone="muted" center style={{ paddingVertical: 24 }}>{t.search.empty}</Text>
      ) : (
        commands.map((item, index) => (
            <View key={`${item.kind}-${item.id}`}>
              {(index === 0 || commands[index - 1].kind !== item.kind) && (
                <Text size={11} weight="semibold" tone="muted" style={{ paddingTop: 10, paddingBottom: 4, paddingHorizontal: 4, letterSpacing: locale === "ar" ? 0 : 0.6 }}>
                  {(item.kind === "action" ? t.search.actions : t.search.places).toUpperCase()}
                </Text>
              )}
              <Pressable
                onPress={() => run(item)}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8, paddingVertical: 9,
                  borderRadius: RADIUS.control, backgroundColor: pressed ? colors.brandSoft : "transparent",
                })}>
                <View style={{ width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" }}>
                  <CommandIcon command={item} dark={dark} color={colors.brand} />
                </View>
                <Text size={15} numberOfLines={1} style={{ flex: 1 }}>{item.label}</Text>
              </Pressable>
            </View>
        ))
      )}
    </Sheet>
  );
}

function CommandIcon({ command, dark, color }: { command: Command; dark: boolean; color: string }) {
  if (command.kind === "place") {
    const Icon = PLACE_ICONS[command.id];
    return <Icon size={16} color={color} />;
  }
  if (command.id === "addExpense") return <Plus size={16} color={color} />;
  return dark ? <Sun size={16} color={color} /> : <Moon size={16} color={color} />;
}
