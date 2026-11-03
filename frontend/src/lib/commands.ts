/**
 * The places and actions of the signed-in area, shared by the website and the app
 * (copied by mobile/scripts/sync-shared.mjs): the phone dock, its More sheet and the search
 * menu all come from these lists, so both platforms offer the same things in the same order.
 */
import type { Messages } from "@/i18n/messages/en";

export type PlaceId =
  | "overview"
  | "expenses"
  | "budget"
  | "goals"
  | "groups"
  | "assistant"
  | "categories"
  | "settings"
  | "income"
  | "recurring"
  | "debts"
  | "challenges"
  | "inflation"
  | "wrapped"
  | "imports"
  | "support";

export interface Place {
  id: PlaceId;
  path: string; // the website's path; the app's Overview is "/" (see appPath)
  label: (t: Messages) => string;
}

export const PLACES: readonly Place[] = [
  { id: "overview", path: "/overview", label: (t) => t.nav.overview },
  { id: "expenses", path: "/expenses", label: (t) => t.nav.expenses },
  { id: "budget", path: "/budget", label: (t) => t.nav.budget },
  { id: "goals", path: "/goals", label: (t) => t.nav.goals },
  { id: "groups", path: "/groups", label: (t) => t.nav.groups },
  { id: "assistant", path: "/assistant", label: (t) => t.nav.assistant },
  { id: "categories", path: "/categories", label: (t) => t.nav.categories },
  { id: "settings", path: "/settings", label: (t) => t.nav.settings },
  { id: "income", path: "/income", label: (t) => t.income.title },
  { id: "recurring", path: "/recurring", label: (t) => t.recurring.title },
  { id: "debts", path: "/debts", label: (t) => t.debts.title },
  { id: "challenges", path: "/challenges", label: (t) => t.challenges.title },
  { id: "inflation", path: "/inflation", label: (t) => t.inflation.title },
  { id: "wrapped", path: "/wrapped", label: (t) => t.wrapped.title },
  { id: "imports", path: "/import", label: (t) => t.imports.title },
  { id: "support", path: "/support", label: (t) => t.support.title },
];

/** The app has no /overview: its first tab is "/". */
export function appPath(place: Place): string {
  return place.id === "overview" ? "/" : place.path;
}

/** Phones: the dock shows these around the centre "+", then More. */
export const DOCK_PLACES: readonly PlaceId[] = ["overview", "expenses", "budget"];
/** The More sheet: the other main places (the rest are in the search menu). */
export const MORE_PLACES: readonly PlaceId[] = ["goals", "groups", "assistant", "categories", "settings"];

export type ActionId = "addExpense" | "toggleTheme";

export type Command =
  | { kind: "action"; id: ActionId; label: string }
  | { kind: "place"; id: PlaceId; label: string; place: Place };

/** Case, accents and dotted/dotless i don't matter ("gelir" finds "Gelir", "cafe" "Café"). */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .trim();
}

/**
 * The search menu's list: actions first, then places, those whose name contains every word
 * typed. An empty query lists everything. `dark` picks the theme action's wording.
 */
export function searchCommands(query: string, t: Messages, dark: boolean): Command[] {
  const all: Command[] = [
    { kind: "action", id: "addExpense", label: t.expenses.add },
    { kind: "action", id: "toggleTheme", label: dark ? t.search.lightTheme : t.search.darkTheme },
    ...PLACES.map((place) => ({ kind: "place" as const, id: place.id, label: place.label(t), place })),
  ];
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return all;
  return all.filter((command) => {
    const label = normalize(command.label);
    return words.every((word) => label.includes(word));
  });
}
