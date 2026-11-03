import { ArrowDownRight, ArrowUpRight, Box, LayoutGrid, Minus } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Polygon, Rect, Text as SvgText } from "react-native-svg";

import { LoadError, PageLoader } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useSpendingYear } from "@/hooks/queries";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { todayISO } from "@/lib/month";
import {
  type Cell,
  type RGB,
  type SkylineFormat,
  barHeight,
  buildGrid,
  camera,
  dayMs,
  depthOf,
  hexToRGB,
  localDate,
  luminance,
  mixRGB,
  monthChange,
  monthLabels,
  project,
  rgbString,
  skylineStats,
  spendingStats,
  yearOfSpending,
} from "@/lib/skyline";
import { useColors } from "@/theme/ThemeProvider";

/**
 * The Overview's "Your year of spending", like the website's: one line comparing this month
 * with the same days of last month, then the last 12 months day by day. The website draws it
 * on a canvas with a camera swing between the views; here it is SVG (react-native-svg) and
 * the two views fade into each other, which a phone redraws smoothly. The maths is shared
 * (lib/skyline.ts).
 */

type View2 = "2d" | "3d";
type Point = [number, number];
type Box3 = { top: Point[]; left: Point[]; right: Point[] };

const TOP = 16; // room for the month names above the flat grid
const PAD = 12;
const FADE_MS = 450;

const pts = (quad: Point[]) => quad.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

function insideQuad(q: Point[], x: number, y: number): boolean {
  let sign = 0;
  for (let k = 0; k < 4; k++) {
    const [ax, ay] = q[k];
    const [bx, by] = q[(k + 1) % 4];
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (Math.abs(cross) < 1e-9) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
}

/** The isometric scene, fitted into `width`: one box per day, nearest drawn last. */
function skylineLayout(cells: Cell[], weeks: number, max: number, width: number) {
  const cam = camera(1);
  const w = 0.9;
  const off = (1 - w) / 2;
  const raw = cells.map((c) => {
    const x0 = c.week + off;
    const y0 = c.day + off;
    const x1 = x0 + w;
    const y1 = y0 + w;
    const z = barHeight(c.amount, max);
    return {
      top: [project(cam, x0, y0, z), project(cam, x1, y0, z), project(cam, x1, y1, z), project(cam, x0, y1, z)],
      left: [project(cam, x0, y1, 0), project(cam, x1, y1, 0), project(cam, x1, y1, z), project(cam, x0, y1, z)],
      right: [project(cam, x1, y0, 0), project(cam, x1, y1, 0), project(cam, x1, y1, z), project(cam, x1, y0, z)],
    };
  });
  const all = raw.flatMap((b) => [...b.top, ...b.left, ...b.right]);
  all.push(project(cam, 0, 8.5, 0), project(cam, weeks, 8.5, 0)); // the month names in front
  const minx = Math.min(...all.map((p) => p[0]));
  const maxx = Math.max(...all.map((p) => p[0]));
  const miny = Math.min(...all.map((p) => p[1]));
  const maxy = Math.max(...all.map((p) => p[1]));
  const bw = Math.max(1e-6, maxx - minx);
  const bh = Math.max(1e-6, maxy - miny);
  const natural = (bh / bw) * (width - 2 * PAD) + 2 * PAD;
  const height = Math.max(Math.min(natural, width * 0.72), Math.min(natural, 200));
  const s = Math.min((width - 2 * PAD) / bw, (height - 2 * PAD) / bh);
  const ox = PAD + (width - 2 * PAD - bw * s) / 2 - minx * s;
  const oy = PAD + (height - 2 * PAD - bh * s) / 2 - miny * s;
  const fit = (p: [number, number]): Point => [ox + p[0] * s, oy + p[1] * s];
  const boxes: Box3[] = raw.map((b) => ({ top: b.top.map(fit), left: b.left.map(fit), right: b.right.map(fit) }));
  const order = cells
    .map((c, i) => ({ i, depth: depthOf(cam, c.week + 0.5, c.day + 0.5) }))
    .sort((a, b) => a.depth - b.depth)
    .map((o) => o.i);
  const label = (week: number) => fit(project(cam, week + 0.5, 7.4, 0));
  return { height, boxes, order, label };
}

export function SpendingYear({ month }: { month: string }) {
  const { t, locale, dir, money, shortDate, percent } = useI18n();
  const colors = useColors();
  const errorMessage = useErrorMessage();
  const year = useSpendingYear(month);
  const current = year.dailies[11];
  const previous = year.dailies[10];
  const today = todayISO();
  const lastDay = current?.days[current.days.length - 1]?.day ?? today;
  const through = lastDay < today ? lastDay : today;
  const intl = LOCALE_INFO[locale].intl;
  const days = useMemo(
    () => (current ? yearOfSpending(year.dailies, current.currency, through) : []),
    [year.dailies, current, through],
  );
  const grid = useMemo(() => buildGrid(days, dayMs(through), 1), [days, through]);
  const months = useMemo(() => monthLabels(grid.cells, grid.weeks, intl), [grid, intl]);

  const [width, setWidth] = useState(0);
  const [view, setView] = useState<View2>("2d");
  const [selected, setSelected] = useState(-1);
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(view === "3d" ? 1 : 0, { duration: FADE_MS });
  }, [view, progress]);
  // Like the website, the skyline rises out of the flat map the first time it shows.
  useEffect(() => {
    const timer = setTimeout(() => setView("3d"), 350);
    return () => clearTimeout(timer);
  }, []);

  // Colours: nothing spent, then healthy → caution → overspent, all from the theme.
  const palette = useMemo(() => {
    const surface = hexToRGB(colors.surface);
    const ink = hexToRGB(colors.ink);
    const dark = luminance(surface) < 0.45;
    const empty = mixRGB(surface, ink, dark ? 0.11 : 0.075);
    return [empty, hexToRGB(colors.brandSoft), hexToRGB(colors.brand), hexToRGB(colors.marigold), hexToRGB(colors.berry)];
  }, [colors]);

  const cell = width > 0 && grid.weeks > 0 ? width / grid.weeks : 0;
  const gap = Math.max(1, cell * 0.16);
  const flatHeight = TOP + cell * 7;
  const scene = useMemo(
    () => (width > 0 && grid.weeks > 0 ? skylineLayout(grid.cells, grid.weeks, grid.max, width) : null),
    [grid, width],
  );
  const skyHeight = scene?.height ?? flatHeight;

  const frameStyle = useAnimatedStyle(() => ({
    height: flatHeight + (skyHeight - flatHeight) * progress.value,
  }));
  const flatStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const skyStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  // The drawings only change with the data, the size or the theme, not with a tap.
  const flatLayer = useMemo(() => {
    if (!cell) return null;
    return (
      <Svg width={width} height={flatHeight}>
        {months.map((m) => (
          <SvgText key={m.week} x={m.week * cell} y={TOP - 4} fontSize={10} fill={colors.muted}>
            {m.label}
          </SvgText>
        ))}
        {grid.cells.map((c, i) => (
          <Rect
            key={i}
            x={c.week * cell + gap / 2}
            y={TOP + c.day * cell + gap / 2}
            width={cell - gap}
            height={cell - gap}
            rx={(cell - gap) * 0.22}
            fill={rgbString(palette[c.level])}
          />
        ))}
      </Svg>
    );
  }, [cell, gap, width, flatHeight, months, grid, palette, colors.muted]);

  const skyLayer = useMemo(() => {
    if (!scene) return null;
    let edge = -Infinity;
    return (
      <Svg width={width} height={scene.height}>
        {scene.order.map((i) => {
          const b = scene.boxes[i];
          const c = palette[grid.cells[i].level];
          return [
            <Polygon key={`l${i}`} points={pts(b.left)} fill={rgbString(shade(c, 0.84))} />,
            <Polygon key={`r${i}`} points={pts(b.right)} fill={rgbString(shade(c, 0.68))} />,
            <Polygon key={`t${i}`} points={pts(b.top)} fill={rgbString(c)} />,
          ];
        })}
        {months.map((m) => {
          const [x, y] = scene.label(m.week);
          if (x < edge || x > width - 24) return null;
          edge = x + 34;
          return (
            <SvgText key={m.week} x={x} y={y + 10} fontSize={10} fill={colors.muted}>
              {m.label}
            </SvgText>
          );
        })}
      </Svg>
    );
  }, [scene, width, months, grid, palette, colors.muted]);

  if (year.isPending) return <PageLoader />;
  if (year.isError) return <LoadError message={errorMessage(year.error)} onRetry={year.refetch} />;
  if (!current) return null;

  const counter = new Intl.NumberFormat(intl);
  const format: SkylineFormat = {
    money: (amount) => money(amount, current.currency),
    date: shortDate,
    count: (value) => counter.format(value),
    percent,
  };
  const stats = spendingStats(days);
  const change = monthChange(current, previous, month, t, format);
  const ChangeIcon = change.direction === "up" ? ArrowUpRight : change.direction === "down" ? ArrowDownRight : Minus;
  const row = dir === "rtl" ? "row-reverse" : "row";

  function tap(event: GestureResponderEvent) {
    const { locationX: x, locationY: y } = event.nativeEvent;
    let hit = -1;
    if (view === "2d" && cell) {
      const week = Math.floor(x / cell);
      const day = Math.floor((y - TOP) / cell);
      if (week >= 0 && week < grid.weeks && day >= 0 && day < 7) hit = week * 7 + day;
    } else if (scene) {
      for (let k = scene.order.length - 1; k >= 0 && hit < 0; k--) {
        const i = scene.order[k];
        const b = scene.boxes[i];
        if (insideQuad(b.top, x, y) || insideQuad(b.left, x, y) || insideQuad(b.right, x, y)) hit = i;
      }
    }
    setSelected(hit >= 0 && hit < grid.cells.length && hit !== selected ? hit : -1);
  }

  const chosen = selected >= 0 ? grid.cells[selected] : null;
  const longDate = new Intl.DateTimeFormat(intl, { weekday: "long", day: "numeric", month: "long" });

  return (
    <View>
      <View style={{ flexDirection: row, alignItems: "center", gap: 6 }}>
        {change.direction && <ChangeIcon size={20} color={colors.ink} />}
        <Text size={17} weight="semibold" style={{ flexShrink: 1 }}>
          {change.text}
        </Text>
      </View>
      {change.note && (
        <Text size={14} tone="muted" style={{ marginTop: 4 }}>
          {change.note}
        </Text>
      )}
      <Text size={15} tone="muted" style={{ marginTop: 16, marginBottom: 16 }}>
        {t.skyline.intro}
      </Text>

      {stats.total <= 0 ? (
        <Text
          size={15}
          tone="muted"
          style={{ borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, paddingHorizontal: 20, paddingVertical: 24 }}>
          {t.skyline.empty}
        </Text>
      ) : (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 12 }}>
          <View style={{ flexDirection: row, justifyContent: "flex-end", marginBottom: 8 }}>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t.skyline.view}
              style={{ flexDirection: "row", borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: 2 }}>
              {(["2d", "3d"] as const).map((v) => {
                const on = view === v;
                const Icon = v === "2d" ? LayoutGrid : Box;
                return (
                  <Pressable
                    key={v}
                    onPress={() => setView(v)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={v === "2d" ? t.skyline.flat : t.skyline.skyline}
                    hitSlop={8}
                    style={{ width: 40, height: 32, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.ink : "transparent" }}>
                    <Icon size={16} color={on ? colors.surface : colors.muted} />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View onLayout={(e: LayoutChangeEvent) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
            {width > 0 && (
              <Pressable
                onPress={tap}
                accessibilityRole="image"
                accessibilityLabel={t.skyline.chartLabel(format.money(stats.total), shortDate(stats.first ?? through), shortDate(through))}>
                <Animated.View style={[{ width, overflow: "hidden" }, frameStyle]}>
                  <Animated.View style={[{ position: "absolute", top: 0, left: 0 }, flatStyle]}>{flatLayer}</Animated.View>
                  <Animated.View style={[{ position: "absolute", top: 0, left: 0 }, skyStyle]}>{skyLayer}</Animated.View>
                </Animated.View>
              </Pressable>
            )}
          </View>

          <Text size={14} weight={chosen ? "semibold" : "regular"} tone={chosen ? "ink" : "muted"} style={{ marginTop: 10 }}>
            {chosen
              ? chosen.amount > 0
                ? t.skyline.spentOn(format.money(chosen.amount), longDate.format(localDate(chosen.date)))
                : t.skyline.nothingOn(longDate.format(localDate(chosen.date)))
              : t.skyline.hintApp}
          </Text>

          <View style={{ flexDirection: row, alignItems: "center", gap: 5, marginTop: 10 }}>
            <Text size={12} tone="muted">{t.skyline.less}</Text>
            {palette.map((c, level) => (
              <View
                key={level}
                accessibilityLabel={t.skyline.levels[level]}
                style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: rgbString(c) }}
              />
            ))}
            <Text size={12} tone="muted">{t.skyline.more}</Text>
          </View>
        </View>
      )}

      {stats.total > 0 && (
        <View style={{ flexDirection: row, flexWrap: "wrap", marginTop: 16, rowGap: 16 }}>
          {skylineStats(stats, t, format).map((block) => (
            <View key={block.label} style={{ width: "50%", paddingEnd: 8 }}>
              <Text size={13} tone="muted">{block.label}</Text>
              <Text size={20} weight="semibold" tone="brand" style={{ marginTop: 2 }}>
                {block.unit ? `${block.value} ${block.unit}` : block.value}
              </Text>
              <Text size={12} tone="muted" numberOfLines={1}>{block.sub}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
