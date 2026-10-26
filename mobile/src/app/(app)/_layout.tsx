import { Stack } from "expo-router";

import { ExpenseSheetProvider } from "@/components/expense/ExpenseSheet";
import { MonthProvider } from "@/components/layout/MonthProvider";
import { PushSetup } from "@/components/layout/PushSetup";
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
      <MonthProvider>
        <ExpenseSheetProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="categories" />
          </Stack>
        </ExpenseSheetProvider>
      </MonthProvider>
    </AppLock>
  );
}
