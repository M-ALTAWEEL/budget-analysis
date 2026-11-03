import Svg, { Path } from "react-native-svg";

import { MARK_BARS, MARK_COIN, MARK_VIEWBOX, WORDMARK } from "@/lib/brand";

export type Frame = { left: number; top: number; width: number; height: number };

/**
 * The mark (lib/brand.ts) laid out at a given width, in points: one frame per bar and one
 * for the coin. The preloader and the loader draw the bars as Views on these frames, so
 * Reanimated can grow them from their bottom edge on the UI thread.
 */
export function markLayout(width: number) {
  const scale = width / MARK_VIEWBOX.width;
  const bars: Frame[] = MARK_BARS.map((bar) => ({
    left: (bar.x - MARK_VIEWBOX.x) * scale,
    top: (bar.y - MARK_VIEWBOX.y) * scale,
    width: bar.width * scale,
    height: bar.height * scale,
  }));
  const coin: Frame = {
    left: (MARK_COIN.cx - MARK_COIN.r - MARK_VIEWBOX.x) * scale,
    top: (MARK_COIN.cy - MARK_COIN.r - MARK_VIEWBOX.y) * scale,
    width: MARK_COIN.r * 2 * scale,
    height: MARK_COIN.r * 2 * scale,
  };
  return { scale, width, height: MARK_VIEWBOX.height * scale, bars, coin };
}

/** The name "ibudgi" as outlines; `size` is the font size it stands for (Sora SemiBold). */
export function Wordmark({ size = 24, color }: { size?: number; color: string }) {
  return (
    <Svg viewBox={WORDMARK.viewBox} width={(WORDMARK.width * size) / 1000} height={(WORDMARK.height * size) / 1000}>
      <Path d={WORDMARK.d} fill={color} />
    </Svg>
  );
}
