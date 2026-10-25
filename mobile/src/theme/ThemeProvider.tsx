/**
 * The website's colours (frontend/src/app/globals.css), light and dark, with the same four
 * accents. Pine = a healthy budget, marigold = caution and "today", berry = overspent.
 */
import * as SecureStore from "expo-secure-store";
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

export type ThemePreference = "light" | "dark" | "system";
export const ACCENTS = ["pine", "ocean", "plum", "graphite"] as const;
export type Accent = (typeof ACCENTS)[number];

const LIGHT = {
  paper: "#f2f5f3",
  surface: "#ffffff",
  ink: "#16302b",
  muted: "#5b6f69",
  line: "#d5ded9",
  pine: "#1e6b57",
  pineDark: "#17543f",
  pineSoft: "#dcebe5",
  marigold: "#c98516",
  marigoldInk: "#9a6408",
  marigoldSoft: "#f8ecd6",
  berry: "#b23c63",
  berrySoft: "#f6e3ea",
  onPine: "#ffffff",
  panel: "#1e6b57",
  logo: "#05194b",
};

const DARK: Palette = {
  paper: "#0e1715",
  surface: "#15211e",
  ink: "#e4ece9",
  muted: "#93a69f",
  line: "#2a3934",
  pine: "#5cc4a0",
  pineDark: "#7fd6b7",
  pineSoft: "#1c3a31",
  marigold: "#e5a53c",
  marigoldInk: "#e5a53c",
  marigoldSoft: "#3a2e17",
  berry: "#ef7fa3",
  berrySoft: "#3a1f2a",
  onPine: "#0b1f19",
  panel: "#12443a",
  logo: "#e9eef7",
};

export type Palette = typeof LIGHT;

/** Only the "pine" family changes with the accent: berry and marigold keep their meaning. */
const ACCENT_COLORS: Record<Exclude<Accent, "pine">, { light: Partial<Palette>; dark: Partial<Palette> }> = {
  ocean: {
    light: { pine: "#1d5fa8", pineDark: "#164a85", pineSoft: "#dce7f5", panel: "#1d5fa8" },
    dark: { pine: "#6aa7ec", pineDark: "#8dbdf2", pineSoft: "#182b44", onPine: "#0b1a2e", panel: "#163a66" },
  },
  plum: {
    light: { pine: "#6b3fa0", pineDark: "#55307f", pineSoft: "#ebe2f5", panel: "#6b3fa0" },
    dark: { pine: "#b18ce6", pineDark: "#c6a9ee", pineSoft: "#2c2140", onPine: "#1c1230", panel: "#3f2766" },
  },
  graphite: {
    light: { pine: "#3d4a5c", pineDark: "#2c3644", pineSoft: "#e3e7ed", panel: "#3d4a5c" },
    dark: { pine: "#a9b6c8", pineDark: "#c2ccda", pineSoft: "#252c36", onPine: "#111720", panel: "#2b3442" },
  },
};

export const SWATCHES: Record<Accent, string> = {
  pine: "#1e6b57",
  ocean: "#1d5fa8",
  plum: "#6b3fa0",
  graphite: "#3d4a5c",
};

interface ThemeValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
  dark: boolean;
  colors: Palette;
}

const ThemeContext = createContext<ThemeValue | null>(null);
const THEME_KEY = "bb.theme";
const ACCENT_KEY = "bb.accent";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [accent, setAccentState] = useState<Accent>("pine");

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY)
      .then((saved) => {
        if (saved === "light" || saved === "dark" || saved === "system") setPreferenceState(saved);
      })
      .catch(() => undefined);
    SecureStore.getItemAsync(ACCENT_KEY)
      .then((saved) => {
        if ((ACCENTS as readonly string[]).includes(saved ?? "")) setAccentState(saved as Accent);
      })
      .catch(() => undefined);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    SecureStore.setItemAsync(THEME_KEY, next).catch(() => undefined);
  }, []);
  const setAccent = useCallback((next: Accent) => {
    setAccentState(next);
    SecureStore.setItemAsync(ACCENT_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const dark = preference === "system" ? system === "dark" : preference === "dark";
    const base = dark ? DARK : LIGHT;
    const tint = accent === "pine" ? {} : ACCENT_COLORS[accent][dark ? "dark" : "light"];
    return { preference, setPreference, accent, setAccent, dark, colors: { ...base, ...tint } };
  }, [preference, setPreference, accent, setAccent, system]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeValue {
  const context = use(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}

export function useColors(): Palette {
  return useTheme().colors;
}
