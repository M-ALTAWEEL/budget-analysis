import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Approx } from "@/components/ui/Approx";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { monthProgress } from "@/lib/month";
import { useColors } from "@/theme/ThemeProvider";
import type { BudgetSummary, Currency, SpendingForecast } from "@/types/api";

const FORECAST_FROM_DAY = 7; // backend/app/ml/forecast.py MIN_DAYS
export type Pace = "on-pace" | "early" | "fast" | "over" | "finished";

/**
 * Is the month heading over budget? Asked of the forecast, which counts rent and other
 * one-offs once. Before day 7 there is no forecast, so the tank does not judge yet.
 */
export function budgetPace(summary: BudgetSummary, month: string, forecast: SpendingForecast | null | undefined): Pace {
  const total = Number(summary.total_amount);
  const spent = Number(summary.spent);
  const progress = monthProgress(month);
  if (spent > total) return "over";
  if (!progress.isCurrent && progress.ratio === 1) return "finished";
  if (progress.isCurrent && forecast) return Number(forecast.total) > total ? "fast" : "on-pace";
  if (progress.isCurrent && progress.dayOfMonth < FORECAST_FROM_DAY) return "early";
  return "on-pace";
}

/** The number counts to its new value (an expense added: "left" visibly goes down). */
function useCountUp(value: number): number {
  const [shown, setShown] = useState(value);
  const animated = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    const id = animated.addListener(({ value: v }) => setShown(v));
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) animated.setValue(value);
      else Animated.timing(animated, { toValue: value, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    });
    return () => animated.removeListener(id);
  }, [value, animated]);
  return shown;
}

/**
 * The "tank" (the website's BudgetTank): the budget drains from the start side as money
 * is spent, a marker shows how far through the month we are, and the colour comes from
 * the forecast (rent on the 1st is paid once, so it doesn't count as "too fast").
 */
function TankView({
  currency, total, spent, timeRatio, daysLeft, label, pace, inverse,
}: {
  currency: Currency; total: number; spent: number; timeRatio: number | null;
  daysLeft: number; label: string; pace: Pace;
  inverse?: boolean; // white on the brand panel: the Overview's hero
}) {
  const colors = useColors();
  const { t, money, dir } = useI18n();
  const remaining = total - spent;
  const spentRatio = total > 0 ? Math.min(spent / total, 1) : 0;
  const shownLeft = useCountUp(Math.max(remaining, 0));
  const fill = pace === "over" ? colors.berry : pace === "fast" ? colors.marigold : inverse ? "#ffffff" : colors.ok;
  const muted = inverse ? "rgba(255, 255, 255, 0.78)" : colors.muted;
  const ink = inverse ? "#ffffff" : colors.ink;
  const daily = daysLeft > 0 && remaining > 0 ? remaining / daysLeft : null;
  const format = (amount: number) => money(amount, currency);
  const width = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    Animated.timing(width, { toValue: spentRatio, duration: 900, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [spentRatio, width]);

  let sentence: string;
  if (pace === "over") sentence = t.tank.over(format(-remaining));
  else if (pace === "finished") sentence = t.tank.finished(format(spent), format(total));
  else if (pace === "fast") sentence = t.tank.fast(format(daily ?? 0));
  else if (pace === "early" && daily !== null) sentence = t.tank.early(format(daily), daysLeft);
  else if (daily !== null) sentence = t.tank.onPaceDaily(format(daily), daysLeft);
  else sentence = t.tank.onPace;

  const start = dir === "rtl" ? "right" : "left";
  return (
    <View>
      <Text size={15} style={{ color: muted }}>{label}</Text>
      <Text display weight="bold" size={46} style={{ marginTop: 4, letterSpacing: -1, color: pace === "over" && !inverse ? colors.berry : ink }}>
        {format(shownLeft)}
      </Text>
      <Approx amount={Math.max(remaining, 0)} currency={currency} size={15} color={muted} />

      <View style={{ marginTop: 34 }}>
        {timeRatio !== null && trackWidth > 0 && (
          <View
            pointerEvents="none"
            style={{ position: "absolute", top: -24, bottom: 0, zIndex: 10, alignItems: "center", width: 60, [start]: timeRatio * trackWidth - 30 }}>
            <Text size={12} weight="semibold" style={{ color: inverse ? "#ffffff" : colors.coralInk }}>{t.tank.today}</Text>
            {/* Coral, the logo's coin: "today". The ring keeps it visible on any fill colour. */}
            <View style={{ marginTop: 4, width: 4, flex: 1, borderRadius: 2, backgroundColor: colors.coral, borderWidth: 0, boxShadow: `0 0 0 3px ${inverse ? colors.panel : colors.surface}` }} />
          </View>
        )}
        <View
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          accessibilityRole="progressbar"
          accessibilityLabel={t.tank.meterLabel}
          accessibilityValue={{ min: 0, max: total, now: Math.min(spent, total), text: t.tank.meterText(format(spent), format(total)) }}
          style={{ height: 64, borderRadius: 20, overflow: "hidden", backgroundColor: inverse ? "rgba(255, 255, 255, 0.15)" : colors.okSoft }}>
          <Animated.View
            style={{
              position: "absolute", top: 0, bottom: 0, [start]: 0, backgroundColor: fill,
              width: width.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
            }}>
            {spentRatio > 0 && spentRatio < 1 && (
              // The edge of the spent part looks like a liquid surface: it's a tank.
              <View style={{ position: "absolute", top: 0, bottom: 0, width: 8, [dir === "rtl" ? "left" : "right"]: -7, transform: dir === "rtl" ? [{ scaleX: -1 }] : [] }}>
                <Svg width="8" height="64" viewBox="0 0 8 64" preserveAspectRatio="none">
                  <Path fill={fill} d="M0 0 H3 C8 4 8 12 3 16 C-2 20 -2 28 3 32 C8 36 8 44 3 48 C-2 52 -2 60 3 64 H0 Z" />
                </Svg>
              </View>
            )}
          </Animated.View>
          {/* Glass: a soft light along the top. */}
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 32, backgroundColor: "#ffffff22" }} />
        </View>
      </View>

      <View style={{ marginTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
        <Text size={14} style={{ color: muted }}>{t.tank.spent(format(spent))}</Text>
        <Text size={14} style={{ color: muted }}>{t.tank.of(format(total))}</Text>
      </View>
      <Text size={15} style={{ marginTop: 14, color: ink }}>{sentence}</Text>
    </View>
  );
}

export function BudgetTank({
  summary, month, forecast, inverse,
}: {
  summary: BudgetSummary; month: string; forecast: SpendingForecast | null | undefined; inverse?: boolean;
}) {
  const total = Number(summary.total_amount);
  const spent = Number(summary.spent);
  const progress = monthProgress(month);
  const { t, monthName } = useI18n();
  const pace = budgetPace(summary, month, forecast);
  return (
    <TankView
      currency={summary.currency}
      total={total}
      spent={spent}
      timeRatio={progress.isCurrent ? progress.ratio : null}
      daysLeft={progress.daysLeft}
      label={t.tank.leftToSpend(monthName(month))}
      pace={pace}
      inverse={inverse}
    />
  );
}
