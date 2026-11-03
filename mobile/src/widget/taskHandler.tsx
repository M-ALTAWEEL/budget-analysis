import type { WidgetTaskHandlerProps } from "react-native-android-widget";

import { BudgetWidget } from "@/widget/BudgetWidget";
import { readSnapshot } from "@/widget/snapshot";

/** Android asks for the widget's picture: when it is added, resized, or every 30 minutes. */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      props.renderWidget(<BudgetWidget snapshot={await readSnapshot()} />);
      break;
    default:
      break;
  }
}
