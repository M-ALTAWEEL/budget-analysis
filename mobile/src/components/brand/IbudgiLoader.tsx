import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { markLayout, type Frame } from "@/components/brand/mark";
import { useI18n } from "@/i18n/I18nProvider";
import { BRAND } from "@/lib/brand";
import { useTheme } from "@/theme/ThemeProvider";

// One cycle, in ms: each bar fills from 10% to 70% of it (staggered by 200 ms), the coin
// pops between 68% and 86%, and the last 150 ms empty everything for the next cycle.
const CYCLE = 2800;
const STAGGER = 200;
const FILL_FROM = 0.1 * CYCLE;
const FILL_TO = 0.7 * CYCLE;
const COIN_FROM = 0.68 * CYCLE;
const COIN_PEAK = 0.78 * CYCLE;
const COIN_TO = 0.86 * CYCLE;
const RESET = 150;
const RESET_FROM = CYCLE - RESET;

export type LoaderVariant = "onLight" | "onBrand";

/** Where each bar's fill is (0–1) at time `t` of the cycle. */
function fillAt(t: number, index: number) {
  "worklet";
  if (t >= RESET_FROM) return 1 - (t - RESET_FROM) / RESET;
  const local = t - index * STAGGER;
  if (local <= FILL_FROM) return 0;
  if (local >= FILL_TO) return 1;
  const x = (local - FILL_FROM) / (FILL_TO - FILL_FROM);
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2; // ease-in-out
}

/** The coin's scale at time `t`: 0, up to 1.35, back to 1. */
function coinAt(t: number) {
  "worklet";
  if (t >= RESET_FROM) return 1 - (t - RESET_FROM) / RESET;
  if (t <= COIN_FROM) return 0;
  if (t <= COIN_PEAK) return (1.35 * (t - COIN_FROM)) / (COIN_PEAK - COIN_FROM);
  if (t <= COIN_TO) return 1.35 - (0.35 * (t - COIN_PEAK)) / (COIN_TO - COIN_PEAK);
  return 1;
}

/**
 * The app's loading indicator ("fill up"): the three bars fill from the bottom, one after
 * the other, then the coin pops. Sizes: 48 by default, 24 in buttons and rows, 72 for a
 * whole screen. `onLight` is indigo on a light background (white in dark mode, where indigo
 * would not show); `onBrand` is white on indigo. `color` paints the bars in another colour
 * (a button's text colour). Reduce Motion: the full logo, gently pulsing.
 */
export function IbudgiLoader({
  size = 48,
  variant = "onLight",
  label,
  color,
}: {
  size?: number;
  variant?: LoaderVariant;
  label?: string;
  color?: string;
}) {
  const { t } = useI18n();
  const { dark } = useTheme();
  const reduceMotion = useReducedMotion();
  const mark = markLayout(size);
  const light = variant === "onLight" && !dark;
  const fill = color ?? (light ? BRAND.indigo : BRAND.white);
  const track = color ? `${color}38` : light ? `${BRAND.indigo}26` : `${BRAND.white}38`; // 22% and 15%
  const clock = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      clock.set(CYCLE - RESET - 1); // full bars, full coin
      pulse.set(withRepeat(withSequence(withTiming(0.55, { duration: 900 }), withTiming(1, { duration: 900 })), -1));
    } else {
      clock.set(0);
      clock.set(withRepeat(withTiming(CYCLE, { duration: CYCLE, easing: Easing.linear }), -1));
    }
    return () => {
      cancelAnimation(clock);
      cancelAnimation(pulse);
    };
  }, [reduceMotion, clock, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const coinStyle = useAnimatedStyle(() => ({ transform: [{ scale: coinAt(clock.value) }] }));

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? t.common.loading}
      style={[{ width: mark.width, height: mark.height, direction: "ltr" }, pulseStyle]}
    >
      {mark.bars.map((frame, i) => (
        <Bar key={i} index={i} frame={frame} clock={clock} fill={fill} track={track} />
      ))}
      <Animated.View
        style={[
          { position: "absolute", ...mark.coin, borderRadius: mark.coin.width / 2, backgroundColor: BRAND.coral },
          coinStyle,
        ]}
      />
    </Animated.View>
  );
}

/** One bar: its track, and the fill growing from the bottom edge on top of it. */
function Bar({
  index,
  frame,
  clock,
  fill,
  track,
}: {
  index: number;
  frame: Frame;
  clock: SharedValue<number>;
  fill: string;
  track: string;
}) {
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: fillAt(clock.value, index) }] }));
  const shape = { position: "absolute" as const, ...frame, borderRadius: frame.width / 2 };
  return (
    <>
      <View style={{ ...shape, backgroundColor: track }} />
      <Animated.View style={[{ ...shape, backgroundColor: fill, transformOrigin: "bottom" }, style]} />
    </>
  );
}
