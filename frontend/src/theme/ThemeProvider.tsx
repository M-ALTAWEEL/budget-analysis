"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
export const THEME_STORAGE_KEY = "bb-theme";

/** The main colour (buttons, the tank, highlights). Pine is the default; see globals.css. */
export const ACCENTS = ["pine", "ocean", "plum", "graphite"] as const;
export type Accent = (typeof ACCENTS)[number];
export const ACCENT_STORAGE_KEY = "bb-accent";

interface ThemeValue {
  preference: ThemePreference;
  resolved: "light" | "dark"; // what is actually on screen
  setPreference: (preference: ThemePreference) => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
}

function readAccent(): Accent {
  try {
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY);
    return ACCENTS.includes(saved as Accent) ? (saved as Accent) : "pine";
  } catch {
    return "pine";
  }
}

const ThemeContext = createContext<ThemeValue | null>(null);
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [ready, setReady] = useState(false);
  const [accent, setAccent] = useState<Accent>("pine");

  // Read the saved choice and follow the device's setting live (e.g. auto dark at night).
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    /* eslint-disable react-hooks/set-state-in-effect -- browser-only values */
    setPreference(readPreference());
    setAccent(readAccent());
    setSystemDark(media.matches);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolved = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    if (!ready) return; // keep what the early script in layout.tsx set
    document.documentElement.dataset.theme = resolved;
    try {
      if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // not saved, still applied for this visit
    }
  }, [preference, resolved, ready]);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    if (accent === "pine") delete root.dataset.accent;
    else root.dataset.accent = accent;
    try {
      if (accent === "pine") localStorage.removeItem(ACCENT_STORAGE_KEY);
      else localStorage.setItem(ACCENT_STORAGE_KEY, accent);
    } catch {
      // not saved, still applied for this visit
    }
  }, [accent, ready]);

  const value = useMemo(
    () => ({ preference, resolved, setPreference, accent, setAccent }),
    [preference, resolved, accent],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}
