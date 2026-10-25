import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, View, type ViewStyle } from "react-native";

import { Text } from "@/components/ui/Text";
import { useColors } from "@/theme/ThemeProvider";

type Variant = "primary" | "secondary" | "danger" | "ghost";

/** The website's buttons: pine, outlined, berry outline, and plain. */
export function Button({
  children,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  small,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  small?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const look: Record<Variant, { bg: string; border: string; text: "onPine" | "ink" | "berry" | "muted" }> = {
    primary: { bg: colors.pine, border: colors.pine, text: "onPine" },
    secondary: { bg: colors.surface, border: colors.line, text: "ink" },
    danger: { bg: colors.surface, border: `${colors.berry}66`, text: "berry" },
    ghost: { bg: "transparent", border: "transparent", text: "muted" },
  };
  const { bg, border, text } = look[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          minHeight: small ? 38 : 46,
          paddingHorizontal: small ? 14 : 20,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: border,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.6 : 1,
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={text === "onPine" ? colors.onPine : colors.pine} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon}
          <Text weight="semibold" size={small ? 14 : 15} tone={text}>
            {children}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
