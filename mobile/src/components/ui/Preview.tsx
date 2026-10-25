import { View } from "react-native";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Text } from "@/components/ui/Text";
import { useColors } from "@/theme/ThemeProvider";

/** Live preview in the category and goal forms: exactly how it will look in lists. */
export function Preview({ icon, color, name }: { icon: string; color: string; name: string }) {
  const colors = useColors();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, paddingVertical: 12 }}>
      <CategoryIcon category={{ icon, color }} />
      <Text weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{name}</Text>
    </View>
  );
}
