import { Check, ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fontFamily } from "@/components/ui/fonts";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useColors } from "@/theme/ThemeProvider";

/** A labelled text box, like the website's Field (label, hint, suffix such as "TRY"). */
export function Field({
  label,
  hint,
  suffix,
  ltr,
  style,
  ...props
}: TextInputProps & { label: string; hint?: string; suffix?: string; ltr?: boolean; style?: ViewStyle }) {
  const colors = useColors();
  const { dir, locale } = useI18n();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text size={14} weight="medium">
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: 46,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: focused ? colors.pine : colors.line,
          backgroundColor: colors.surface,
        }}>
        <TextInput
          placeholderTextColor={`${colors.muted}b3`}
          accessibilityLabel={label}
          {...props}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          style={{
            flex: 1,
            minHeight: 44,
            paddingHorizontal: 14,
            fontSize: 15,
            color: colors.ink,
            fontFamily: fontFamily(false, "regular", locale === "ar"),
            // ltr: emails, codes and phone numbers read left to right even in Arabic.
            textAlign: ltr ? "left" : dir === "rtl" ? "right" : "left",
            writingDirection: ltr ? "ltr" : dir,
          }}
        />
        {suffix && (
          <Text size={14} tone="muted" style={{ paddingHorizontal: 14 }}>
            {suffix}
          </Text>
        )}
      </View>
      {hint && (
        <Text size={14} tone="muted">
          {hint}
        </Text>
      )}
    </View>
  );
}

/** A choice from a list (the website's <select>): opens a sheet with the options. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  style,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text size={14} weight="medium">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{
          opacity: disabled ? 0.5 : 1,
          minHeight: 46,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.surface,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}>
        <Text style={{ flex: 1 }}>{current}</Text>
        <ChevronDown size={18} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "#0008", justifyContent: "flex-end" }} onPress={() => setOpen(false)}>
          <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <Text display weight="semibold" size={18} style={{ padding: 20, paddingBottom: 8 }}>
              {label}
            </Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: option.value === value }}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    backgroundColor: pressed ? colors.pineSoft : "transparent",
                  })}>
                  <Text style={{ flex: 1 }} weight={option.value === value ? "semibold" : "regular"}>
                    {option.label}
                  </Text>
                  {option.value === value && <Check size={18} color={colors.pine} />}
                </Pressable>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </Modal>
    </View>
  );
}

export function FormError({ message }: { message: string | null | undefined }) {
  const colors = useColors();
  if (!message) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{ borderRadius: 12, backgroundColor: colors.berrySoft, paddingHorizontal: 14, paddingVertical: 10 }}>
      <Text size={14} tone="berry">
        {message}
      </Text>
    </View>
  );
}
