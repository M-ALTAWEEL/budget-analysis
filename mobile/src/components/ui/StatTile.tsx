import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";

import { Text } from "@/components/ui/Text";
import { useColors } from "@/theme/ThemeProvider";

/** The website's StatTile: a label, the value (with an optional unit), and a note under it. */
export function StatTile({
  label,
  value,
  unit,
  note,
  style,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: string;
  style?: ViewStyle;
}) {
  const colors = useColors();
  return (
    <View style={[{ gap: 2, minWidth: 0, borderRadius: 16, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 12 }, style]}>
      <Text size={12} tone="muted">{label}</Text>
      <Text size={20} weight="semibold" style={{ letterSpacing: -0.4 }}>
        {value}
        {unit ? <Text size={13} weight="medium" tone="muted">{` ${unit}`}</Text> : null}
      </Text>
      {note ? <Text size={11.5} tone="muted" numberOfLines={1}>{note}</Text> : null}
    </View>
  );
}
