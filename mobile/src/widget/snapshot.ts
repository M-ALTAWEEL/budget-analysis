import { File, Paths } from "expo-file-system";

/**
 * What the home-screen widget shows (feature F12). The app writes it whenever the month's
 * numbers change; the widget reads it, even when the app isn't running. The texts are
 * ready to show, in the person's language. Nothing is kept after signing out.
 */
export interface WidgetSnapshot {
  title: string; // "Left this month"
  left: string; // "1,250.00 TRY"
  detail: string; // "Spent 2,750.00 of 4,000.00"
  ratio: number; // 0..1, how much of the budget is gone
  over: boolean; // overspent
  add: string; // "+ Add expense"
  empty: string | null; // "Set a budget in the app" when there is no budget
  rtl: boolean;
}

const file = () => new File(Paths.document, "widget.json");

export async function readSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const f = file();
    return f.exists ? (JSON.parse(await f.text()) as WidgetSnapshot) : null;
  } catch {
    return null;
  }
}

export function writeSnapshot(snapshot: WidgetSnapshot | null) {
  try {
    const f = file();
    if (snapshot === null) {
      if (f.exists) f.delete();
      return;
    }
    if (!f.exists) f.create();
    f.write(JSON.stringify(snapshot));
  } catch {
    // the widget keeps what it showed last
  }
}
