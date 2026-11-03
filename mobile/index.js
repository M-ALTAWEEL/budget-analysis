// The app's entry: expo-router, plus the Android home-screen widget (feature F12), whose
// task runs even when the app is closed.
import "expo-router/entry";
import { registerWidgetTaskHandler } from "react-native-android-widget";

import { widgetTaskHandler } from "./src/widget/taskHandler";

registerWidgetTaskHandler(widgetTaskHandler);
