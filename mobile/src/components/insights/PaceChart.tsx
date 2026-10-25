import { useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";

import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { cumulative, daysElapsed } from "@/lib/insights";
import { useColors } from "@/theme/ThemeProvider";
import type { DailySpending } from "@/types/api";

const PLOT_HEIGHT = 190;
const TOP = 28;
const AXIS_BAND = 26;
const LABEL_SIDE = 46;
const FAR_SIDE = 14;

/**
 * The website's PaceChart: running total against an "even pace" line, plus the forecast.
 * Touch and drag to see any day; the table under it has every value.
 */
export function PaceChart({ daily, month }: { daily: DailySpending; month: string }) {
  const { t, money, shortDate, compact, dir } = useI18n();
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  const days = daily.days;
  const count = days.length;
  const total = Number(daily.total_amount);
  const elapsed = daysElapsed(month);
  const running = cumulative(days.map((day) => Number(day.spent))).slice(0, elapsed);
  const evenAt = (index: number) => (total * (index + 1)) / count;
  const last = running.length - 1;
  const format = (amount: number) => money(amount, daily.currency);
  const forecast = daily.forecast && running.length ? Number(daily.forecast.total) : null;
  const forecastOver = forecast !== null && forecast > total;
  const forecastColor = forecastOver ? colors.berry : colors.pine;

  const rtl = dir === "rtl";
  const plotStart = LABEL_SIDE;
  const plotWidth = Math.max(width - LABEL_SIDE - FAR_SIDE, 1);
  const yMax = Math.max(total, ...running, forecast ?? 0, 1) * 1.08;
  const flip = (x: number) => (rtl ? width - x : x);
  const x = (index: number) => flip(plotStart + (count > 1 ? index / (count - 1) : 0) * plotWidth);
  const y = (value: number) => TOP + PLOT_HEIGHT - (value / yMax) * PLOT_HEIGHT;
  const baseline = y(0);
  // SVG text anchors don't mirror by themselves on the phone: swap them in Arabic.
  const anchor = (a: "start" | "middle" | "end") => (rtl && a !== "middle" ? (a === "start" ? "end" : "start") : a);

  const linePath = running.map((value, i) => `${i ? "L" : "M"}${x(i)},${y(value)}`).join("");
  const areaPath = running.length ? `${linePath}L${x(last)},${baseline}L${x(0)},${baseline}Z` : "";
  const yTicks = [0, total / 2, total];
  const xTicks = [0, 7, 14, 21, count - 1].filter((i) => i < count);
  const lastSelectable = running.length ? last : count - 1;
  const height = TOP + PLOT_HEIGHT + AXIS_BAND;

  function pick(locationX: number) {
    const fromStart = rtl ? width - locationX - plotStart : locationX - plotStart;
    const index = Math.round((fromStart / plotWidth) * (count - 1));
    setActive(Math.min(Math.max(index, 0), lastSelectable));
  }

  const tooltipLeft = active === null ? 0 : Math.min(Math.max(x(active), 80), width - 80) - 80;
  const dot = active !== null && active <= last ? active : last;
  const legendLine = (color: string, dashed?: boolean) => (
    <View style={{ width: 16, height: 0, borderTopWidth: 2, borderColor: color, borderStyle: dashed ? "dashed" : "solid" }} />
  );

  return (
    <View>
      {forecast !== null && (
        <Text size={14} style={{ marginBottom: 12 }}>
          {forecastOver
            ? t.insights.forecastOver(format(forecast), format(forecast - total))
            : t.insights.forecastUnder(format(forecast), format(total - forecast))}
        </Text>
      )}

      <View style={{ marginBottom: 12, flexDirection: "row", flexWrap: "wrap", columnGap: 20, rowGap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {legendLine(colors.pine)}
          <Text size={14} tone="muted">{t.insights.yourSpending}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {legendLine(`${colors.muted}99`)}
          <Text size={14} tone="muted">{t.insights.evenPace}</Text>
        </View>
        {forecast !== null && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {legendLine(forecastColor, true)}
            <Text size={14} tone="muted">{t.insights.forecast}</Text>
          </View>
        )}
      </View>

      <View
        style={{ height }}
        onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))}
        accessible
        accessibilityLabel={
          running.length ? `${t.insights.paceTitle}. ${t.insights.chartSummary(format(running[last]), format(evenAt(last)))}` : t.insights.paceTitle
        }
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => true}
        onResponderGrant={(event) => pick(event.nativeEvent.locationX)}
        onResponderMove={(event) => pick(event.nativeEvent.locationX)}
        onResponderRelease={() => setActive(null)}
        onResponderTerminate={() => setActive(null)}>
        {width > 0 && (
          <Svg width={width} height={height} pointerEvents="none">
            {yTicks.map((value) => (
              <G key={value}>
                <Line x1={flip(plotStart)} x2={flip(plotStart + plotWidth)} y1={y(value)} y2={y(value)} stroke={colors.line} strokeWidth={1} />
                <SvgText x={flip(plotStart - 8)} y={y(value) + 4} textAnchor={anchor("end")} fontSize={11} fill={colors.muted}>
                  {compact(value)}
                </SvgText>
              </G>
            ))}
            {xTicks.map((index) => (
              <SvgText
                key={index}
                x={x(index)}
                y={TOP + PLOT_HEIGHT + 18}
                textAnchor={anchor(index === 0 ? "start" : index === count - 1 ? "end" : "middle")}
                fontSize={11}
                fill={colors.muted}>
                {shortDate(days[index].day)}
              </SvgText>
            ))}

            <Line x1={x(0)} y1={y(evenAt(0))} x2={x(count - 1)} y2={y(total)} stroke={colors.muted} strokeOpacity={0.6} strokeWidth={1.5} strokeLinecap="round" />

            {areaPath ? <Path d={areaPath} fill={colors.pine} fillOpacity={0.1} /> : null}
            {linePath ? <Path d={linePath} fill="none" stroke={colors.pine} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}

            {forecast !== null && (
              <G>
                <Line x1={x(last)} y1={y(running[last])} x2={x(count - 1)} y2={y(forecast)} stroke={forecastColor} strokeWidth={2} strokeDasharray="5 5" strokeLinecap="round" />
                <Circle cx={x(count - 1)} cy={y(forecast)} r={3.5} fill={colors.surface} stroke={forecastColor} strokeWidth={2} />
                {active === null && last < count * 0.75 && (
                  <SvgText x={x(count - 1)} y={y(forecast) - 12} textAnchor={anchor("end")} fontSize={12} fontWeight="600" fill={forecastOver ? colors.berry : colors.ink}>
                    {`≈ ${format(forecast)}`}
                  </SvgText>
                )}
              </G>
            )}

            {active !== null && (
              <Line x1={x(active)} x2={x(active)} y1={TOP - 8} y2={baseline} stroke={colors.ink} strokeOpacity={0.35} strokeWidth={1} />
            )}

            {running.length > 0 && (
              <G>
                <Circle cx={x(dot)} cy={y(running[dot])} r={4.5} fill={colors.pine} stroke={colors.surface} strokeWidth={2} />
                {active === null && (
                  <SvgText x={x(last)} y={y(running[last]) - 12} textAnchor={anchor(last > count * 0.75 ? "end" : "middle")} fontSize={12} fontWeight="600" fill={colors.ink}>
                    {format(running[last])}
                  </SvgText>
                )}
              </G>
            )}
          </Svg>
        )}

        {active !== null && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute", top: 0, left: tooltipLeft, width: 160, zIndex: 10,
              borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
              paddingHorizontal: 12, paddingVertical: 8,
              shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
            }}>
            <Text size={12} tone="muted">{shortDate(days[active].day)}</Text>
            {active <= last && (
              <>
                <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ height: 2, width: 12, borderRadius: 1, backgroundColor: colors.pine }} />
                  <Text size={14} weight="semibold">{format(running[active])}</Text>
                </View>
                <Text size={12} tone="muted">{t.insights.spentByThisDay}</Text>
                <Text size={12} tone="muted" style={{ marginTop: 4 }}>{t.insights.onThisDay(format(Number(days[active].spent)))}</Text>
              </>
            )}
            <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ height: 2, width: 12, borderRadius: 1, backgroundColor: `${colors.muted}99` }} />
              <Text size={12} tone="muted" style={{ flex: 1 }}>{t.insights.evenPaceValue(format(evenAt(active)))}</Text>
            </View>
          </View>
        )}
      </View>

      {running.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Pressable onPress={() => setTable((open) => !open)} accessibilityRole="button" accessibilityState={{ expanded: table }} hitSlop={8}>
            <Text size={14} tone="muted">{table ? "▾ " : "▸ "}{t.insights.showTable}</Text>
          </Pressable>
          {table && (
            <View style={{ marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }}>
              {[null, ...running.map((_, i) => i)].map((i) => (
                <View
                  key={i ?? "head"}
                  style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: i === null ? 0 : 1, borderColor: colors.line, backgroundColor: colors.surface }}>
                  <Text size={13} tone={i === null ? "muted" : "ink"} weight={i === null ? "medium" : "regular"} style={{ flex: 1.2 }}>
                    {i === null ? t.insights.day : shortDate(days[i].day)}
                  </Text>
                  <Text size={13} end tone={i === null ? "muted" : "ink"} weight={i === null ? "medium" : "regular"} style={{ flex: 1 }}>
                    {i === null ? t.insights.thatDay : format(Number(days[i].spent))}
                  </Text>
                  <Text size={13} end tone={i === null ? "muted" : "ink"} weight={i === null ? "medium" : "semibold"} style={{ flex: 1 }}>
                    {i === null ? t.insights.soFar : format(running[i])}
                  </Text>
                  <Text size={13} end tone="muted" weight={i === null ? "medium" : "regular"} style={{ flex: 1 }}>
                    {i === null ? t.insights.evenPace : format(evenAt(i))}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
