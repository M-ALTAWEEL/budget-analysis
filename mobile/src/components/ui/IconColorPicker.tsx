import { Check } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { COLOR_CHOICES, IconGlyph } from "@/components/ui/CategoryIcon";
import { Text } from "@/components/ui/Text";
import { useColors } from "@/theme/ThemeProvider";

/** Icon grid + colour swatches, shared by the category and savings-goal forms. */
export function IconColorPicker({
  icons, icon, onIcon, color, onColor, iconLabel, colorLabel,
}: {
  icons: string[]; icon: string; onIcon: (icon: string) => void;
  color: string; onColor: (color: string) => void; iconLabel: string; colorLabel: string;
}) {
  const colors = useColors();
  return (
    <>
      <View>
        <Text size={14} weight="medium" style={{ marginBottom: 8 }}>{iconLabel}</Text>
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {icons.map((choice) => {
            const selected = choice === icon;
            return (
              <Pressable
                key={choice}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={choice.replace(/-/g, " ")}
                onPress={() => onIcon(choice)}
                style={{
                  width: "11.4%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 8,
                  borderWidth: selected ? 2 : 1, borderColor: selected ? colors.pine : colors.line,
                  backgroundColor: selected ? colors.pineSoft : "transparent",
                }}>
                <IconGlyph name={choice} color={selected ? colors.pineDark : colors.muted} size={20} />
              </Pressable>
            );
          })}
        </View>
      </View>
      <View>
        <Text size={14} weight="medium" style={{ marginBottom: 8 }}>{colorLabel}</Text>
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {COLOR_CHOICES.map((choice) => {
            const selected = choice === color;
            return (
              <Pressable
                key={choice}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={choice}
                onPress={() => onColor(choice)}
                style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: selected ? colors.ink : "transparent" }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: choice, alignItems: "center", justifyContent: "center" }}>
                  {selected && <Check size={16} color="#fff" />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );
}
