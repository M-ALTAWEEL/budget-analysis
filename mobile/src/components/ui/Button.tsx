import type { ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";

import { IbudgiLoader } from "@/components/brand/IbudgiLoader";
import { Text } from "@/components/ui/Text";
import { useColors } from "@/theme/ThemeProvider";
import { RADIUS } from "@/theme/tokens";

type Variant = "primary" | "secondary" | "danger" | "ghost";

/** The website's buttons: brand, outlined, berry outline, and plain. */
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
  const look: Record<Variant, { bg: string; border: string; text: "onBrand" | "brand" | "berry" | "muted" }> = {
    primary: { bg: colors.brand, border: colors.brand, text: "onBrand" },
    secondary: { bg: colors.surface, border: colors.line, text: "brand" },
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
          borderRadius: RADIUS.control,
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
        <IbudgiLoader size={24} color={text === "onBrand" ? colors.onBrand : undefined} />
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
