import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { Card } from "@/components/ui/Layout";
import { StatusChip, type Status } from "@/components/ui/StatusChip";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { monthProgress } from "@/lib/month";
import { useColors, type Palette } from "@/theme/ThemeProvider";
import { EASE } from "@/theme/tokens";
import type { BudgetSummary } from "@/types/api";

import type { Pace } from "./BudgetTank";

const SIZE = 116;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The tank's judgement as a chip: on track, careful (heading over), or over. */
export function paceStatus(pace: Pace): Exclude<Status, "brand"> {
  return pace === "over" ? "bad" : pace === "fast" ? "warn" : "ok";
}

const STROKES: Record<Exclude<Status, "brand">, keyof Palette> = { ok: "ok", warn: "marigold", bad: "berry" };

/** The website's BudgetRing: how much of the month's budget is used, with spent, left and days left. */
export function BudgetRing({ summary, month, pace }: { summary: BudgetSummary; month: string; pace: Pace }) {
  const colors = useColors();
  const { t, money, dir } = useI18n();
  const reduced = useReducedMotion();
  const total = Number(summary.total_amount);
  const spent = Number(summary.spent);
  const ratio = total > 0 ? spent / total : 0;
  const status = paceStatus(pace);
  const progress = monthProgress(month);
  const format = (amount: number) => money(amount, summary.currency);

  const shown = useSharedValue(reduced ? Math.min(ratio, 1) : 0);
  useEffect(() => {
    const target = Math.min(ratio, 1);
    shown.set(reduced ? target : withTiming(target, { duration: 1000, easing: EASE.smooth }));
  }, [ratio, reduced, shown]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - shown.get()) }));

  const rows = [
    { label: t.overview.spentLabel, value: format(spent), over: false },
    { label: t.overview.leftLabel, value: format(total - spent), over: spent > total },
    ...(progress.isCurrent ? [{ label: t.overview.daysLabel, value: String(progress.daysLeft), over: false }] : []),
  ];

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Text display weight="semibold" size={16} accessibilityRole="header" style={{ flexShrink: 1 }}>{t.overview.budgetTitle}</Text>
        <StatusChip status={status}>{t.overview.status[status]}</StatusChip>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
        <View style={{ width: SIZE, height: SIZE }} accessible accessibilityLabel={`${Math.round(ratio * 100)}% ${t.overview.used}`}>
          {/* Starts at the top and runs clockwise (counter-clockwise in Arabic). */}
          <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: "-90deg" }, ...(dir === "rtl" ? [{ scaleY: -1 }] : [])] }}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke={colors.sunken} strokeWidth={STROKE} />
            <AnimatedCircle
              cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none"
              stroke={colors[STROKES[status]]} strokeWidth={STROKE} strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE} animatedProps={arc}
            />
          </Svg>
          <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
            <Text size={24} weight="semibold" style={{ letterSpacing: -0.5 }}>{Math.round(ratio * 100)}%</Text>
            <Text size={12} tone="muted">{t.overview.used}</Text>
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
          {rows.map((row) => (
            <View key={row.label}>
              <Text size={12} tone="muted">{row.label}</Text>
              <Text weight="semibold" tone={row.over ? "berry" : "ink"} numberOfLines={1}>{row.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}
