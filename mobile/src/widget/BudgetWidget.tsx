import { FlexWidget, TextWidget } from "react-native-android-widget";

import type { WidgetSnapshot } from "@/widget/snapshot";

const PINE = "#1f6f54";
const BERRY = "#b4235a";
const PAPER = "#fbfaf6";
const INK = "#1c2421";
const MUTED = "#5f6b66";
const LINE = "#e3e1d9";

/** The home-screen widget (feature F12): what is left this month, and a button to add an
 *  expense. Signed out, or before the first sync: a button that opens the app. */
export function BudgetWidget({ snapshot }: { snapshot: WidgetSnapshot | null }) {
  const align = snapshot?.rtl ? "flex-end" : "flex-start";
  if (!snapshot || snapshot.empty) {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{ height: "match_parent", width: "match_parent", backgroundColor: PAPER, borderRadius: 20, padding: 16, justifyContent: "center", alignItems: "center" }}>
        <TextWidget text="Budget Analysis" style={{ fontSize: 16, color: PINE, fontWeight: "bold" }} />
        <TextWidget text={snapshot?.empty ?? "Open the app"} style={{ fontSize: 13, color: MUTED, marginTop: 4 }} />
      </FlexWidget>
    );
  }
  const used = Math.max(0, Math.min(snapshot.ratio, 1));
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: "match_parent", width: "match_parent", backgroundColor: PAPER, borderRadius: 20, padding: 16, flexDirection: "column", justifyContent: "space-between" }}>
      <FlexWidget style={{ width: "match_parent", flexDirection: "column", alignItems: align }}>
        <TextWidget text={snapshot.title} style={{ fontSize: 13, color: MUTED }} />
        <TextWidget text={snapshot.left} style={{ fontSize: 24, fontWeight: "bold", color: snapshot.over ? BERRY : INK }} />
        <TextWidget text={snapshot.detail} style={{ fontSize: 12, color: MUTED }} />
      </FlexWidget>
      <FlexWidget style={{ width: "match_parent", height: 8, borderRadius: 4, backgroundColor: LINE, flexDirection: "row" }}>
        {used > 0 ? (
          <FlexWidget style={{ height: "match_parent", flex: Math.round(used * 100), borderRadius: 4, backgroundColor: snapshot.over || used > 0.9 ? BERRY : PINE }} />
        ) : null}
        {used < 1 ? <FlexWidget style={{ height: "match_parent", flex: Math.round((1 - used) * 100) }} /> : null}
      </FlexWidget>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: "budgetanalysis://add-expense" }}
        style={{ width: "match_parent", backgroundColor: PINE, borderRadius: 12, paddingVertical: 8, alignItems: "center" }}>
        <TextWidget text={snapshot.add} style={{ fontSize: 14, color: "#ffffff", fontWeight: "bold" }} />
      </FlexWidget>
    </FlexWidget>
  );
}
