import { useEffect, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useColors } from "@/theme/ThemeProvider";
import { EASE } from "@/theme/tokens";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: (color: string) => ReactNode;
}

/**
 * The website's Segmented: a pill switch between a few options, with a white thumb that
 * slides to the chosen one. Each option is a radio button for screen readers.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const colors = useColors();
  const { dir } = useI18n();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const segment = width > 0 ? (width - 6) / options.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    // translateX is not mirrored in right-to-left layouts, so the thumb moves the other way.
    const target = index * segment * (dir === "rtl" ? -1 : 1);
    x.set(reduced ? target : withTiming(target, { duration: 350, easing: EASE.spring }));
  }, [index, segment, dir, reduced, x]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ flexDirection: "row", alignSelf: "flex-start", padding: 3, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.sunken }}>
      {segment > 0 && (
        <Animated.View
          style={[
            { position: "absolute", top: 3, bottom: 3, start: 3, width: segment, borderRadius: 999, backgroundColor: colors.surface, boxShadow: "0 1px 3px rgba(21, 23, 42, 0.14)" },
            thumb,
          ]}
        />
      )}
      {options.map((option) => {
        const selected = option.value === value;
        const color = selected ? colors.ink : colors.muted;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6 }}>
            {option.icon?.(color)}
            <Text size={13} weight="semibold" numberOfLines={1} style={{ color }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
