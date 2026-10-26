import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { setRestoredAtLaunch } from "@/components/security/AppLock";
import { takeLocalePickedWhileSignedOut } from "@/components/settings/useChangeLocale";
import { FONT_FILES } from "@/components/ui/fonts";
import { Toaster } from "@/components/ui/Toast";
import { I18nProvider, useI18n } from "@/i18n/I18nProvider";
import { updateMe } from "@/services/auth";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";

void SplashScreen.preventAutoHideAsync();

let launchSeen = false;

/** Once the account is known, the app and the account agree on one language (as on the website). */
function AccountLocale() {
  const { user, updateUser } = useAuth();
  const { setLocale } = useI18n();
  useEffect(() => {
    if (!user) return;
    const picked = takeLocalePickedWhileSignedOut();
    if (picked && picked !== user.locale) {
      setLocale(picked);
      updateMe({ locale: picked }).then(updateUser).catch(() => {});
    } else {
      setLocale(user.locale);
    }
  }, [user, setLocale, updateUser]);
  return null;
}

/** Signed in → the app; signed out → the sign-in screen. The splash stays until we know. */
function Routes({ fontsReady }: { fontsReady: boolean }) {
  const { status } = useAuth();
  const { dir } = useI18n();
  // The first answer after "loading" says how the app opened (read by the app lock).
  if (!launchSeen && status !== "loading") {
    launchSeen = true;
    setRestoredAtLaunch(status === "authenticated");
  }
  const { colors, dark } = useTheme();
  const ready = fontsReady && status !== "loading";
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;
  return (
    // direction: rows, paddings and icons follow the language (Arabic: right to left).
    <View style={{ flex: 1, direction: dir, backgroundColor: colors.paper }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Protected guard={status === "authenticated"}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={status === "anonymous"}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      <Toaster />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } }),
  );
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AccountLocale />
              <Routes fontsReady={fontsLoaded || Boolean(fontError)} />
            </AuthProvider>
          </QueryClientProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
