import { Stack } from "expo-router";

import { useColors } from "@/theme/ThemeProvider";

export default function GroupsLayout() {
  const colors = useColors();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />;
}
