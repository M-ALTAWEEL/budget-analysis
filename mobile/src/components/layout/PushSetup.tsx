import * as Notifications from "expo-notifications";
import { useRouter, type Href } from "expo-router";
import { useEffect } from "react";

import { registerForPush } from "@/lib/push";

/**
 * Signed in: register this phone for notifications if the person already allowed them
 * (never asks by itself: the question comes from Settings), and open the right screen
 * when a notification is tapped.
 */
export function PushSetup() {
  const router = useRouter();

  useEffect(() => {
    void registerForPush(false).catch(() => undefined);

    const open = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/")) router.push(url as Href);
    };
    // Tapped while the app was closed: the app opens, then goes there.
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [router]);

  return null;
}
