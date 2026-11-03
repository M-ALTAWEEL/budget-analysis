import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useColors, type Palette } from "@/theme/ThemeProvider";

export type Status = "ok" | "warn" | "bad" | "brand";

const TONES: Record<Status, { bg: keyof Palette; fg: keyof Palette }> = {
  ok: { bg: "okSoft", fg: "ok" },
  warn: { bg: "marigoldSoft", fg: "marigoldInk" },
  bad: { bg: "berrySoft", fg: "berry" },
  brand: { bg: "brandSoft", fg: "brand" },
};

/** The website's StatusChip: a small pill with a dot (on track, careful, over, or brand). */
export function StatusChip({ status, children }: { status: Status; children: ReactNode }) {
  const colors = useColors();
  const { bg, fg } = TONES[status];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
        backgroundColor: colors[bg],
      }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors[fg] }} />
      <Text size={12} weight="semibold" numberOfLines={1} style={{ color: colors[fg] }}>
        {children}
      </Text>
    </View>
  );
}
