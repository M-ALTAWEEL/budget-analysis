/**
 * The website's fonts (frontend/src/app/layout.tsx): Bricolage Grotesque for headings and
 * numbers, Instrument Sans for text, Readex Pro for Arabic (both roles), Montserrat for
 * the logo. On a phone every weight is its own font file, so a weight is a family name.
 */
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from "@expo-google-fonts/bricolage-grotesque";
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from "@expo-google-fonts/instrument-sans";
import { Montserrat_400Regular, Montserrat_700Bold } from "@expo-google-fonts/montserrat";
import {
  ReadexPro_400Regular,
  ReadexPro_500Medium,
  ReadexPro_600SemiBold,
  ReadexPro_700Bold,
} from "@expo-google-fonts/readex-pro";

export const FONT_FILES = {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
  Montserrat_400Regular,
  Montserrat_700Bold,
  ReadexPro_400Regular,
  ReadexPro_500Medium,
  ReadexPro_600SemiBold,
  ReadexPro_700Bold,
};

export type Weight = "regular" | "medium" | "semibold" | "bold";

export function fontFamily(display: boolean, weight: Weight, arabic: boolean): string {
  if (arabic) {
    return {
      regular: "ReadexPro_400Regular",
      medium: "ReadexPro_500Medium",
      semibold: "ReadexPro_600SemiBold",
      bold: "ReadexPro_700Bold",
    }[weight];
  }
  if (display) return weight === "bold" ? "BricolageGrotesque_700Bold" : "BricolageGrotesque_600SemiBold";
  return {
    regular: "InstrumentSans_400Regular",
    medium: "InstrumentSans_500Medium",
    semibold: "InstrumentSans_600SemiBold",
    bold: "InstrumentSans_700Bold",
  }[weight];
}
