import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarDays, X } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, View, type ViewStyle } from "react-native";

import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useColors, useTheme } from "@/theme/ThemeProvider";

const toISO = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromISO = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** A date as YYYY-MM-DD (like <input type="date">), picked with the phone's own calendar. */
export function DateField({
  label, value, onChange, max, min, optional, placeholder, style,
}: {
  label: string; value: string; onChange: (iso: string) => void; max?: string; min?: string;
  /** May be left empty (value ""): shows the placeholder and a button to clear it. */
  optional?: boolean; placeholder?: string; style?: ViewStyle;
}) {
  const colors = useColors();
  const { dark } = useTheme();
  const { dayLabel, locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <View style={style}>
      <Text size={14} weight="medium" style={{ marginBottom: 6 }}>{label}</Text>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? dayLabel(value) : placeholder ?? ""}`}
        style={{
          minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: open ? colors.pine : colors.line,
          backgroundColor: colors.surface, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8,
        }}>
        <CalendarDays size={18} color={colors.muted} />
        <Text size={15} tone={value ? "ink" : "muted"} style={{ flex: 1 }}>{value ? dayLabel(value) : placeholder ?? "—"}</Text>
        {optional && value !== "" && (
          <Pressable onPress={() => { setOpen(false); onChange(""); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.common.delete}>
            <X size={16} color={colors.muted} />
          </Pressable>
        )}
      </Pressable>
      {open && (
        <DateTimePicker
          value={value ? fromISO(value) : min ? fromISO(min) : new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          maximumDate={max ? fromISO(max) : undefined}
          minimumDate={min ? fromISO(min) : undefined}
          themeVariant={dark ? "dark" : "light"}
          accentColor={colors.pine}
          locale={locale}
          onChange={(event, date) => {
            if (Platform.OS !== "ios") setOpen(false);
            if (event.type === "set" && date) onChange(toISO(date));
          }}
        />
      )}
    </View>
  );
}
