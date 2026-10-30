import { Stack } from "expo-router";

import { ExpenseSheetProvider } from "@/components/expense/ExpenseSheet";
import { MonthProvider } from "@/components/layout/MonthProvider";
import { PendingLink } from "@/components/layout/PendingLink";
import { PushSetup } from "@/components/layout/PushSetup";
import { OfflineSync } from "@/components/offline/Offline";
import { AppLock } from "@/components/security/AppLock";
import { useColors } from "@/theme/ThemeProvider";

/**
 * The signed-in app: the tabs, and screens that open on top of them (Categories,
 * reached from Budget and Settings, slides in with a back button and back gesture).
 */
export default function AppLayout() {
  const colors = useColors();
  return (
    <AppLock>
      <PushSetup />
      <PendingLink />
      <OfflineSync />
      <MonthProvider>
        <ExpenseSheetProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="categories" />
            <Stack.Screen name="expenses-category" />
            <Stack.Screen name="recurring" />
            <Stack.Screen name="debts" />
            <Stack.Screen name="income" />
            <Stack.Screen name="wrapped" />
            <Stack.Screen name="challenges" />
            <Stack.Screen name="inflation" />
          </Stack>
        </ExpenseSheetProvider>
      </MonthProvider>
    </AppLock>
  );
}
