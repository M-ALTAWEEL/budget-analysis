/**
 * Push notifications (phase 6): ask the phone, get its Expo push token, tell the server.
 * Works in a development or store build, on a phone or an Android emulator with Google
 * Play. Expo Go (Android) and the iOS simulator can't: then nothing happens, nothing breaks.
 */
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { api } from "@/lib/api";

const KEY = "bb.push-token"; // remembered, so signing out can remove it from the server

// While the app is open, a notification still shows as a banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PushPermission = "granted" | "denied" | "undetermined" | "unsupported";

// The iOS simulator has no push at all; an Android emulator with Google Play does.
const noPush = () => !Device.isDevice && Platform.OS === "ios";

export async function pushPermission(): Promise<PushPermission> {
  if (noPush()) return "unsupported";
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/** Registers this phone. `ask`: show the system question if it was never asked. */
export async function registerForPush(ask: boolean): Promise<PushPermission> {
  if (noPush()) return "unsupported";
  let { status } = await Notifications.getPermissionsAsync();
  if (status === "undetermined" && ask) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return status;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Budget Analysis",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return "unsupported"; // not linked to EAS yet (npx eas-cli init)
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.post("/me/push-devices", { token, platform: Platform.OS === "ios" ? "ios" : "android" });
    await SecureStore.setItemAsync(KEY, token);
  } catch {
    // No network, or Expo Go on Android: try again next time the app opens.
  }
  return "granted";
}

/** Signing out: this phone stops getting this account's notifications. */
export async function forgetPushDevice(): Promise<void> {
  const token = await SecureStore.getItemAsync(KEY).catch(() => null);
  if (!token) return;
  await api.post("/me/push-devices/remove", { token }).catch(() => undefined);
  await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
}
