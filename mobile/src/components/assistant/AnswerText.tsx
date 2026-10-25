import { Pressable, View } from "react-native";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useColors } from "@/theme/ThemeProvider";
import type { AssistantAnswer, Currency } from "@/types/api";

/** The server sends numbers; the sentence is written here, in the student's language. */
export function AnswerText({ answer, onAsk }: { answer: AssistantAnswer; onAsk: (question: string) => void }) {
  const { t, money, percent, categoryName } = useI18n();
  const a = t.assistant;
  const cur = (answer.currency ?? "TRY") as Currency;
  const m = (value: string | null) => money(value ?? "0", cur);
  const period = answer.period ? a.periods[answer.period] : "";
  const category = answer.category ? categoryName(answer.category) : null;
  const P = ({ children }: { children: React.ReactNode }) => <Text size={15} style={{ lineHeight: 24 }}>{children}</Text>;

  switch (answer.intent) {
    case "spent": {
      const count = answer.count ?? 0;
      if (count === 0) return <P>{category ? a.spentNothingOn(category, period) : a.spentNothing(period)}</P>;
      return <P>{category ? a.spentOn(m(answer.amount), category, period, count) : a.spent(m(answer.amount), period, count)}</P>;
    }
    case "remaining": {
      const remaining = Number(answer.remaining);
      if (remaining < 0) {
        const over = m(String(-remaining));
        return <P>{category ? a.overOn(category, over) : a.over(over)}</P>;
      }
      return (
        <P>
          {category ? a.remainingOn(m(answer.remaining), category, m(answer.total)) : a.remaining(m(answer.remaining), m(answer.total))}{" "}
          {a.perDay(m(answer.daily), answer.days_left ?? 1)}
        </P>
      );
    }
    case "top":
      if (answer.categories.length === 0) return <P>{a.spentNothing(period)}</P>;
      return (
        <View>
          <P>{a.top(period, m(answer.amount))}</P>
          <View style={{ marginTop: 12, gap: 8 }}>
            {answer.categories.map((row) => (
              <View key={row.category.uuid} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <CategoryIcon category={row.category} size="sm" />
                <Text size={15} weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{categoryName(row.category)}</Text>
                <Text size={15}>{m(row.spent)}</Text>
                <Text size={14} tone="muted" end style={{ width: 48 }}>{percent(Number(row.spent) / Number(answer.amount || 1))}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    case "forecast": {
      if (answer.forecast === null) return <P>{a.forecastEarly(answer.through_day ?? 1, m(answer.amount))}</P>;
      const gap = Number(answer.total) - Number(answer.forecast);
      return (
        <P>{gap >= 0 ? t.insights.forecastUnder(m(answer.forecast), m(String(gap))) : t.insights.forecastOver(m(answer.forecast), m(String(-gap)))}</P>
      );
    }
    case "compare": {
      const now = Number(answer.amount);
      const before = Number(answer.previous);
      if (before === 0) return <P>{a.compareNothing(m(answer.amount))}</P>;
      const change = percent(Math.abs(now - before) / before);
      const days = answer.through_day ?? 1;
      return (
        <P>
          {now >= before
            ? a.compareMore(m(answer.amount), m(answer.previous), days, change)
            : a.compareLess(m(answer.amount), m(answer.previous), days, change)}
        </P>
      );
    }
    case "goals":
      if (answer.goals.length === 0) return <P>{a.goalsNone}</P>;
      return (
        <View>
          <P>{a.goals}</P>
          <View style={{ marginTop: 12, gap: 8 }}>
            {answer.goals.map((goal) => (
              <P key={goal.uuid}>
                {goal.achieved
                  ? a.goalDone(goal.name)
                  : a.goalLine(goal.name, money(goal.saved, goal.currency), money(goal.target_amount, goal.currency), percent(Number(goal.progress)))}
                {!goal.achieved && goal.monthly_needed && Number(goal.monthly_needed) > 0 && (
                  <Text size={15} tone="muted"> {a.goalMonthly(money(goal.monthly_needed, goal.currency))}</Text>
                )}
              </P>
            ))}
          </View>
        </View>
      );
    case "no_budget":
      return <P>{a.noBudget}</P>;
    default:
      return (
        <View>
          <P>{answer.intent === "help" ? a.help : a.unknown}</P>
          <Suggestions onAsk={onAsk} style={{ marginTop: 12 }} />
        </View>
      );
  }
}

export function Suggestions({ onAsk, style }: { onAsk: (q: string) => void; style?: object }) {
  const { t } = useI18n();
  const colors = useColors();
  return (
    <View style={[{ flexDirection: "row", flexWrap: "wrap", gap: 8 }, style]}>
      {t.assistant.suggestions.map((question) => (
        <Pressable
          key={question}
          onPress={() => onAsk(question)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            borderRadius: 999, borderWidth: 1, borderColor: pressed ? colors.pine : colors.line, backgroundColor: colors.surface,
            paddingHorizontal: 14, paddingVertical: 6, transform: [{ scale: pressed ? 0.95 : 1 }],
          })}>
          <Text size={14}>{question}</Text>
        </Pressable>
      ))}
    </View>
  );
}
