// The app's entry: expo-router, plus the Android home-screen widget (feature F12), whose
// task runs even when the app is closed.
import "expo-router/entry";
import { Platform } from "react-native";
import { registerWidgetTaskHandler } from "react-native-android-widget";

import { widgetTaskHandler } from "./src/widget/taskHandler";

// The widget exists only on Android. On the web (expo start --web) the call would throw
// (AppRegistry there has no headless tasks) and leave a blank page.
if (Platform.OS === "android") registerWidgetTaskHandler(widgetTaskHandler);
