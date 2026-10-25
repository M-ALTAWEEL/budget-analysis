import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/Text";

/** A titled section of the settings screen (the website's <section> + h2). */
export function SettingsBlock({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View>
      <Text display weight="semibold" size={18} accessibilityRole="header" style={{ marginBottom: hint ? 4 : 12 }}>{title}</Text>
      {hint && <Text size={14} tone="muted" style={{ marginBottom: 12 }}>{hint}</Text>}
      {children}
    </View>
  );
}
