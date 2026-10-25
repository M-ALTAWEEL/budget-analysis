import { useId } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, G, Mask, Path, Rect } from "react-native-svg";

import { Text } from "@/components/ui/Text";
import { useColors } from "@/theme/ThemeProvider";

/** The website's logo: three bars and a coin, drawn as SVG, the navy parts follow the theme. */
export function LogoMark({ height = 36 }: { height?: number }) {
  const colors = useColors();
  const gap = useId().replace(/:/g, "");
  return (
    <Svg viewBox="0 0 280 228" height={height} width={(height * 280) / 228}>
      <Defs>
        <Mask id={gap}>
          <Rect width="280" height="228" fill="#fff" />
          <Circle cx="208" cy="160" r="78" fill="#000" />
        </Mask>
      </Defs>
      <G mask={`url(#${gap})`}>
        <Rect x="3" y="121" width="57" height="104" fill={colors.logo} />
        <Rect x="58" y="210" width="24" height="15" fill={colors.logo} />
        <Rect x="80" y="62" width="58" height="163" fill={colors.logo} />
        <Rect x="157" y="4" width="58" height="150" fill="#13b375" />
      </G>
      <Circle cx="208" cy="160" r="66" fill={colors.logo} />
      <Circle cx="208" cy="160" r="49" fill="#13b375" />
      <G fill="none" stroke="#05194b" strokeWidth="5.5" strokeLinecap="round">
        <Path d="M 172.4 166.3 A 36 36 0 0 1 210.5 124.1" />
        <Path d="M 243.6 153.7 A 36 36 0 0 1 205.5 195.9" />
      </G>
      <Path
        fill="#05194b"
        d="M208 133v6c-9 1-15 6-15 13 0 8 6 11 14 13 7 2 10 3 10 7 0 4-4 6-9 6-6 0-10-3-11-7l-7 2c1 6 7 11 14 12v6h6v-6c9-1 15-6 15-13 0-8-6-11-14-13-7-2-10-3-10-7 0-3 4-6 8-6 5 0 8 3 9 6l7-2c-2-6-7-10-13-11v-6z"
      />
    </Svg>
  );
}

/** Mark and name together. Always left to right: it is a name, not a sentence. */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const big = size === "lg";
  const colors = useColors();
  const name = { fontFamily: "Montserrat_700Bold", color: colors.logo, fontSize: big ? 19 : 16, lineHeight: big ? 19 : 16 };
  return (
    <View accessible accessibilityLabel="Budget Analysis" style={{ direction: "ltr", flexDirection: "row", alignItems: "center", gap: 10 }}>
      <LogoMark height={big ? 44 : 36} />
      <View>
        <Text style={{ ...name, letterSpacing: -0.3, textAlign: "left", writingDirection: "ltr" }}>Budget</Text>
        <Text style={{ ...name, fontFamily: "Montserrat_400Regular", textAlign: "left", writingDirection: "ltr" }}>Analysis</Text>
      </View>
    </View>
  );
}
