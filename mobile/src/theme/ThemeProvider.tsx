/**
 * The website's colours (frontend/src/app/globals.css), light and dark, with the same five
 * accents. Brand = buttons, links and selection (indigo by default). Ok = a healthy budget,
 * marigold = caution, berry = overspent; coral only for small highlights such as "today".
 */
import * as SecureStore from "expo-secure-store";
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

export type ThemePreference = "light" | "dark" | "system";
export const ACCENTS = ["indigo", "pine", "ocean", "plum", "graphite"] as const;
export type Accent = (typeof ACCENTS)[number];

const LIGHT = {
  paper: "#ffffff",
  surface: "#ffffff",
  sunken: "#f6f6fb",
  ink: "#15172a",
  muted: "#5e6178",
  line: "#e4e4f0",
  brand: "#3a36db",
  brandDark: "#2d29b8",
  brandSoft: "#ecebfc",
  onBrand: "#ffffff",
  coral: "#ff7a59",
  coralInk: "#b8421f",
  ok: "#1e7a55",
  okSoft: "#e3f4ec",
  marigold: "#c98516",
  marigoldInk: "#9a6408",
  marigoldSoft: "#f8ecd6",
  berry: "#b23c63",
  berrySoft: "#f6e3ea",
  cell0: "#e5e5ef",
  lv1: "#b7e0cb",
  panel: "#3a36db",
  logo: "#15172A",
};

const DARK: Palette = {
  paper: "#0f1020",
  surface: "#181a33",
  sunken: "#13152b",
  ink: "#ecedf7",
  muted: "#9a9dba",
  line: "#2a2d4d",
  brand: "#8b88ff",
  brandDark: "#a9a7ff",
  brandSoft: "#23245a",
  onBrand: "#0f1020",
  coral: "#ff7a59",
  coralInk: "#ff9c82",
  ok: "#5cc4a0",
  okSoft: "#1c3a31",
  marigold: "#e5a53c",
  marigoldInk: "#e5a53c",
  marigoldSoft: "#3a2e17",
  berry: "#ef7fa3",
  berrySoft: "#3a1f2a",
  cell0: "#24274a",
  lv1: "#2b5a48",
  panel: "#24217a",
  logo: "#FFFFFF",
};

export type Palette = typeof LIGHT;

/** Only the brand family changes with the accent: ok, marigold and berry keep their meaning. */
const ACCENT_COLORS: Record<Exclude<Accent, "indigo">, { light: Partial<Palette>; dark: Partial<Palette> }> = {
  pine: {
    light: { brand: "#1e6b57", brandDark: "#17543f", brandSoft: "#dcebe5", panel: "#1e6b57" },
    dark: { brand: "#5cc4a0", brandDark: "#7fd6b7", brandSoft: "#1c3a31", onBrand: "#0b1f19", panel: "#12443a" },
  },
  ocean: {
    light: { brand: "#1d5fa8", brandDark: "#164a85", brandSoft: "#dce7f5", panel: "#1d5fa8" },
    dark: { brand: "#6aa7ec", brandDark: "#8dbdf2", brandSoft: "#182b44", onBrand: "#0b1a2e", panel: "#163a66" },
  },
  plum: {
    light: { brand: "#6b3fa0", brandDark: "#55307f", brandSoft: "#ebe2f5", panel: "#6b3fa0" },
    dark: { brand: "#b18ce6", brandDark: "#c6a9ee", brandSoft: "#2c2140", onBrand: "#1c1230", panel: "#3f2766" },
  },
  graphite: {
    light: { brand: "#3d4a5c", brandDark: "#2c3644", brandSoft: "#e3e7ed", panel: "#3d4a5c" },
    dark: { brand: "#a9b6c8", brandDark: "#c2ccda", brandSoft: "#252c36", onBrand: "#111720", panel: "#2b3442" },
  },
};

export const SWATCHES: Record<Accent, string> = {
  indigo: "#3a36db",
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
  const [accent, setAccentState] = useState<Accent>("indigo");

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
    const tint = accent === "indigo" ? {} : ACCENT_COLORS[accent][dark ? "dark" : "light"];
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
