import { Check, ChevronDown, Moon, Sun } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { LOCALES, LOCALE_INFO, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";

import { useChangeLocale } from "./useChangeLocale";

const FLAG: Record<Locale, string> = { en: "🇬🇧", ar: "🇸🇦", tr: "🇹🇷" };

/** Compact language picker for the top of the sign-in screen. */
export function LanguageMenu() {
  const { locale, t } = useI18n();
  const { colors } = useTheme();
  const changeLocale = useChangeLocale();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t.settings.language}
        style={{ height: 36, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 12 }}>
        <Text size={14}>{FLAG[locale]}</Text>
        <Text size={14}>{LOCALE_INFO[locale].label}</Text>
        <ChevronDown size={16} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "#00000040", justifyContent: "center", padding: 40 }}>
          <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingVertical: 4, overflow: "hidden" }}>
            {LOCALES.map((code) => (
              <Pressable
                key={code}
                onPress={() => {
                  setOpen(false);
                  void changeLocale(code);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: code === locale }}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pressed ? `${colors.ink}0d` : "transparent" })}>
                <Text size={16}>{FLAG[code]}</Text>
                <Text size={15} style={{ flex: 1 }}>{LOCALE_INFO[code].label}</Text>
                {code === locale && <Check size={16} color={colors.pine} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/** One-tap light/dark switch for the sign-in screen. Settings has the full choice. */
export function ThemeButton() {
  const { dark, setPreference, colors } = useTheme();
  const { t } = useI18n();
  const next = dark ? "light" : "dark";
  return (
    <Pressable
      onPress={() => setPreference(next)}
      accessibilityRole="button"
      accessibilityLabel={next === "dark" ? t.settings.dark : t.settings.light}
      style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
      {dark ? <Sun size={16} color={colors.muted} /> : <Moon size={16} color={colors.muted} />}
    </Pressable>
  );
}
