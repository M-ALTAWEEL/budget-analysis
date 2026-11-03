import type { ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";

import { useColors } from "@/theme/ThemeProvider";
import { RADIUS } from "@/theme/tokens";

/**
 * The website's IconButton: a square button with only an icon. `label` is required (the
 * accessible name); `dot` adds the coral "something new" dot.
 */
export function IconButton({
  label,
  onPress,
  dot,
  children,
  style,
}: {
  label: string;
  onPress: () => void;
  dot?: boolean;
  children: ReactNode;
  style?: ViewStyle;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        {
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: RADIUS.control,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: pressed ? colors.sunken : colors.surface,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
        style,
      ]}>
      {children}
      {dot && (
        <View
          style={{ position: "absolute", top: 10, end: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral, borderWidth: 2, borderColor: colors.surface }}
        />
      )}
    </Pressable>
  );
}
