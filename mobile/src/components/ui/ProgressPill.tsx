import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { useColors } from "@/theme/ThemeProvider";
import { EASE } from "@/theme/tokens";

/**
 * The website's ProgressPill: a pill-shaped bar that grows in from the start side (right in
 * Arabic, through the layout direction). `color` is the fill, `track` the empty part.
 */
export function ProgressPill({
  value,
  color,
  track,
  height = 8,
  label,
}: {
  value: number; // 0..1, clamped
  color?: string;
  track?: string;
  height?: number;
  label?: string; // when set, the bar is announced as a progress bar
}) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const ratio = Math.min(Math.max(value, 0), 1);
  const width = useSharedValue(reduced ? ratio : 0);

  useEffect(() => {
    width.set(reduced ? ratio : withDelay(200, withTiming(ratio, { duration: 900, easing: EASE.smooth })));
  }, [ratio, reduced, width]);

  const fill = useAnimatedStyle(() => ({ width: `${width.get() * 100}%` }));

  return (
    <View
      accessible={Boolean(label)}
      accessibilityRole={label ? "progressbar" : undefined}
      accessibilityLabel={label}
      accessibilityValue={label ? { min: 0, max: 100, now: Math.round(ratio * 100) } : undefined}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"}
      style={{ height, borderRadius: height / 2, overflow: "hidden", backgroundColor: track ?? colors.sunken }}>
      <Animated.View style={[{ height: "100%", borderRadius: height / 2, backgroundColor: color ?? colors.ok }, fill]} />
    </View>
  );
}
