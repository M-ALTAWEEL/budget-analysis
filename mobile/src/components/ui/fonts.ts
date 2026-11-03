/**
 * The website's fonts (frontend/src/app/layout.tsx): Geist for headings, text and numbers,
 * Readex Pro for Arabic. The logo's name is an outlined path (lib/brand.ts), so it needs no
 * font. On a phone every weight is its own font file, so a weight is a family name.
 */
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from "@expo-google-fonts/geist";
import {
  ReadexPro_400Regular,
  ReadexPro_500Medium,
  ReadexPro_600SemiBold,
  ReadexPro_700Bold,
} from "@expo-google-fonts/readex-pro";

export const FONT_FILES = {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  ReadexPro_400Regular,
  ReadexPro_500Medium,
  ReadexPro_600SemiBold,
  ReadexPro_700Bold,
};

export type Weight = "regular" | "medium" | "semibold" | "bold";

/** Headings (`display`) use the same face as text, never lighter than semibold. */
export function fontFamily(display: boolean, weight: Weight, arabic: boolean): string {
  if (arabic) {
    return {
      regular: "ReadexPro_400Regular",
      medium: "ReadexPro_500Medium",
      semibold: "ReadexPro_600SemiBold",
      bold: "ReadexPro_700Bold",
    }[weight];
  }
  if (display) return weight === "bold" ? "Geist_700Bold" : "Geist_600SemiBold";
  return {
    regular: "Geist_400Regular",
    medium: "Geist_500Medium",
    semibold: "Geist_600SemiBold",
    bold: "Geist_700Bold",
  }[weight];
}
