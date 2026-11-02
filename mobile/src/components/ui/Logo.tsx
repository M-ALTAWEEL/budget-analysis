import { View } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

import { BRAND, LOGO, MARK_BAR_RADIUS, MARK_BARS, MARK_COIN, WORDMARK } from "@/lib/brand";
import { useColors } from "@/theme/ThemeProvider";

/** The ibudgi icon: the indigo tile with the white bars and the coral coin. */
function Tile() {
  return (
    <>
      <Rect width="100" height="100" rx={LOGO.tileRadius} fill={BRAND.indigo} />
      <G transform={LOGO.markTransform}>
        {MARK_BARS.map((bar) => (
          <Rect key={bar.x} {...bar} rx={MARK_BAR_RADIUS} fill={BRAND.white} />
        ))}
        <Circle {...MARK_COIN} fill={BRAND.coral} />
      </G>
    </>
  );
}

/** The icon on its own (the brand kit's ibudgi-icon.svg), as on the website. */
export function LogoMark({ height = 36 }: { height?: number }) {
  return (
    <Svg viewBox="0 0 100 100" height={height} width={height}>
      <Tile />
    </Svg>
  );
}

/**
 * The ibudgi logo (the kit's ibudgi-logo.svg): the name uses the `logo` colour, brand ink
 * in light mode and white in dark mode. Always left to right: it is a name, not a sentence.
 */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const colors = useColors();
  const height = size === "lg" ? 44 : 36;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="ibudgi" style={{ direction: "ltr" }}>
      <Svg viewBox={`0 0 ${LOGO.width} ${LOGO.height}`} height={height} width={(height * LOGO.width) / LOGO.height}>
        <Tile />
        <Path transform={LOGO.wordmarkTransform} d={WORDMARK.d} fill={colors.logo} />
      </Svg>
    </View>
  );
}
