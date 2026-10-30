import { Switch, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useColors } from "@/theme/ThemeProvider";

/** A labelled on/off row in a form (the website's checkbox "switch" rows). */
export function SwitchRow({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, paddingVertical: 12 }}>
      <View style={{ flex: 1 }}>
        <Text weight="semibold">{label}</Text>
        {hint && <Text size={14} tone="muted" style={{ marginTop: 2 }}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        accessibilityLabel={label}
        onValueChange={onChange}
        trackColor={{ true: colors.pine, false: colors.line }}
        thumbColor="#fff"
      />
    </View>
  );
}
