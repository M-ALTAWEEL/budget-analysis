import type { ReactNode } from "react";
import { Text as NativeText, type TextProps, type TextStyle } from "react-native";

import { fontFamily, type Weight } from "@/components/ui/fonts";
import { useI18n } from "@/i18n/I18nProvider";
import { useColors, type Palette } from "@/theme/ThemeProvider";

type Tone = "ink" | "muted" | "pine" | "berry" | "marigold" | "onPine";

/**
 * All text in the app. `display` is the heading font (Bricolage), otherwise the body font.
 * It follows the language: Readex Pro and right-to-left in Arabic. Numbers keep their
 * width (tabular) so amounts line up.
 */
export function Text({
  children,
  display,
  weight = "regular",
  size = 16,
  tone = "ink",
  center,
  end,
  style,
  ...props
}: Omit<TextProps, "style"> & {
  children?: ReactNode;
  display?: boolean;
  weight?: Weight;
  size?: number;
  tone?: Tone;
  center?: boolean;
  end?: boolean;
  style?: TextStyle | TextStyle[];
}) {
  const colors = useColors();
  const { locale, dir } = useI18n();
  const rtl = dir === "rtl";
  const toneColor: Record<Tone, keyof Palette> = {
    ink: "ink",
    muted: "muted",
    pine: "pine",
    berry: "berry",
    marigold: "marigoldInk",
    onPine: "onPine",
  };
  const align: TextStyle["textAlign"] = center ? "center" : end !== rtl ? "right" : "left";
  return (
    <NativeText
      // Android measures some Arabic text a little short and cuts the last word off
      // ("تغيير كلمة" instead of "تغيير كلمة السر"): the simple line breaker doesn't.
      textBreakStrategy="simple"
      {...props}
      style={[
        {
          color: colors[toneColor[tone]],
          fontFamily: fontFamily(Boolean(display), weight, locale === "ar"),
          fontSize: size,
          lineHeight: Math.round(size * (display ? 1.2 : 1.45)),
          textAlign: align,
          writingDirection: dir,
          fontVariant: ["tabular-nums"],
        },
        ...(Array.isArray(style) ? style : style ? [style] : []),
      ]}>
      {children}
    </NativeText>
  );
}
