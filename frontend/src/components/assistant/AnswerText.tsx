"use client";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useI18n } from "@/i18n/I18nProvider";
import type { AssistantAnswer, Currency } from "@/types/api";

/** The server sends numbers; the sentence is written here, in the student's language. */
export function AnswerText({
  answer,
  onAsk,
}: {
  answer: AssistantAnswer;
  onAsk: (question: string) => void;
}) {
  const { t, money, percent, categoryName } = useI18n();
  const a = t.assistant;
  const cur = (answer.currency ?? "TRY") as Currency;
  const m = (value: string | null) => money(value ?? "0", cur);
  const period = answer.period ? a.periods[answer.period] : "";
  const category = answer.category ? categoryName(answer.category) : null;

  switch (answer.intent) {
    case "spent": {
      const count = answer.count ?? 0;
      if (count === 0) {
        return <p>{category ? a.spentNothingOn(category, period) : a.spentNothing(period)}</p>;
      }
      return (
        <p>
          {category
            ? a.spentOn(m(answer.amount), category, period, count)
            : a.spent(m(answer.amount), period, count)}
        </p>
      );
    }

    case "remaining": {
      const remaining = Number(answer.remaining);
      if (remaining < 0) {
        const over = m(String(-remaining));
        return <p>{category ? a.overOn(category, over) : a.over(over)}</p>;
      }
      return (
        <p>
          {category
            ? a.remainingOn(m(answer.remaining), category, m(answer.total))
            : a.remaining(m(answer.remaining), m(answer.total))}{" "}
          {a.perDay(m(answer.daily), answer.days_left ?? 1)}
        </p>
      );
    }

    case "top":
      if (answer.categories.length === 0) return <p>{a.spentNothing(period)}</p>;
      return (
        <div>
          <p>{a.top(period, m(answer.amount))}</p>
          <ul className="mt-3 space-y-2">
            {answer.categories.map((row) => (
              <li key={row.category.uuid} className="flex items-center gap-3">
                <CategoryIcon category={row.category} size="sm" />
                <span className="min-w-0 flex-1 truncate font-semibold">{categoryName(row.category)}</span>
                <span className="tabular-nums">{m(row.spent)}</span>
                <span className="w-12 text-end text-sm text-muted tabular-nums">
                  {percent(Number(row.spent) / Number(answer.amount || 1))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );

    case "forecast": {
      if (answer.forecast === null) {
        return <p>{a.forecastEarly(answer.through_day ?? 1, m(answer.amount))}</p>;
      }
      const gap = Number(answer.total) - Number(answer.forecast);
      return (
        <p>
          {gap >= 0
            ? t.insights.forecastUnder(m(answer.forecast), m(String(gap)))
            : t.insights.forecastOver(m(answer.forecast), m(String(-gap)))}
        </p>
      );
    }

    case "compare": {
      const now = Number(answer.amount);
      const before = Number(answer.previous);
      if (before === 0) return <p>{a.compareNothing(m(answer.amount))}</p>;
      const change = percent(Math.abs(now - before) / before);
      const days = answer.through_day ?? 1;
      return (
        <p>
          {now >= before
            ? a.compareMore(m(answer.amount), m(answer.previous), days, change)
            : a.compareLess(m(answer.amount), m(answer.previous), days, change)}
        </p>
      );
    }

    case "goals":
      if (answer.goals.length === 0) return <p>{a.goalsNone}</p>;
      return (
        <div>
          <p>{a.goals}</p>
          <ul className="mt-3 space-y-2">
            {answer.goals.map((goal) => (
              <li key={goal.uuid}>
                {goal.achieved
                  ? a.goalDone(goal.name)
                  : a.goalLine(
                      goal.name,
                      money(goal.saved, goal.currency),
                      money(goal.target_amount, goal.currency),
                      percent(Number(goal.progress)),
                    )}
                {!goal.achieved && goal.monthly_needed && Number(goal.monthly_needed) > 0 && (
                  <span className="text-muted"> {a.goalMonthly(money(goal.monthly_needed, goal.currency))}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      );

    case "no_budget":
      return <p>{a.noBudget}</p>;

    // "help" and "unknown": show what can be asked, as buttons.
    default:
      return (
        <div>
          <p>{answer.intent === "help" ? a.help : a.unknown}</p>
          <Suggestions onAsk={onAsk} className="mt-3" />
        </div>
      );
  }
}

export function Suggestions({ onAsk, className = "" }: { onAsk: (q: string) => void; className?: string }) {
  const { t } = useI18n();
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {t.assistant.suggestions.map((question) => (
        <button
          key={question}
          type="button"
          onClick={() => onAsk(question)}
          className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink transition-[border-color,transform] hover:border-pine active:scale-95"
        >
          {question}
        </button>
      ))}
    </div>
  );
}
