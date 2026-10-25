import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { createContext, use, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { currentMonth, firstVisibleMonth, setBudgetCycle, shiftMonth } from "@/lib/month";
import { useColors } from "@/theme/ThemeProvider";

const MonthContext = createContext<{ month: string; setMonth: (month: string) => void } | null>(null);

/**
 * The month being looked at, shared by the overview, expenses and budget screens.
 * The account says on which day a month starts and whether the student started fresh:
 * when that changes, everything below starts again on the new current month.
 */
export function MonthProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const startDay = user?.month_start_day ?? 1;
  const freshStart = user?.fresh_start_on ?? null;
  setBudgetCycle(startDay, freshStart); // before anything below renders
  return <MonthState key={`${startDay}-${freshStart}`}>{children}</MonthState>;
}

function MonthState({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(currentMonth);
  return <MonthContext value={{ month, setMonth }}>{children}</MonthContext>;
}

export function useMonth() {
  const context = use(MonthContext);
  if (!context) throw new Error("useMonth must be used inside <MonthProvider>");
  return context;
}

export function MonthSwitcher() {
  const { month, setMonth } = useMonth();
  const { t, monthLabel, dir } = useI18n();
  const colors = useColors();
  // One month ahead is allowed: next month's budget can be planned before it starts.
  const isLast = month === shiftMonth(currentMonth(), 1);
  // After a fresh start, the months before it are hidden.
  const first = firstVisibleMonth();
  const isFirst = first !== null && month <= first;
  const flip = dir === "rtl" ? [{ scaleX: -1 }] : [];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.month.previous}
        onPress={() => setMonth(shiftMonth(month, -1))}
        disabled={isFirst}
        hitSlop={8}
        style={{ padding: 8, opacity: isFirst ? 0 : 1 }}>
        <ChevronLeft size={22} color={colors.muted} style={{ transform: flip }} />
      </Pressable>
      <Text display weight="semibold" size={24} center accessibilityLiveRegion="polite" style={{ minWidth: 176 }}>
        {monthLabel(month)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.month.next}
        onPress={() => setMonth(shiftMonth(month, 1))}
        disabled={isLast}
        hitSlop={8}
        style={{ padding: 8, opacity: isLast ? 0 : 1 }}>
        <ChevronRight size={22} color={colors.muted} style={{ transform: flip }} />
      </Pressable>
    </View>
  );
}
