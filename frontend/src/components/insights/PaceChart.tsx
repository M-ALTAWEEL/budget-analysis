"use client";

import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/i18n/I18nProvider";
import { cumulative, daysElapsed } from "@/lib/insights";
import type { DailySpending } from "@/types/api";

// Plot geometry, in pixels. The chart is drawn at its real width (measured), not scaled,
// so text stays 12px on every screen.
const PLOT_HEIGHT = 190;
const TOP = 28; // room for the end label above the line
const AXIS_BAND = 26; // x-axis labels under the plot
const LABEL_SIDE = 46; // y-axis labels (left, or right in Arabic)
const FAR_SIDE = 14;

/**
 * Running total of spending against an "even pace" line that reaches the budget on the
 * last day. One series is the story (pine); the even pace is grey context.
 * Hover or arrow keys show any day; the table under it has every value without hovering.
 */
export function PaceChart({ daily, month }: { daily: DailySpending; month: string }) {
  const { t, money, shortDate, compact, dir } = useI18n();
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  // Draw at the container's real width, and redraw when it changes.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const days = daily.days;
  const count = days.length;
  const total = Number(daily.total_amount);
  const elapsed = daysElapsed(month); // future days are not drawn
  const running = cumulative(days.map((day) => Number(day.spent))).slice(0, elapsed);
  const evenAt = (index: number) => (total * (index + 1)) / count;
  const last = running.length - 1;
  const format = (amount: number) => money(amount, daily.currency);

  // ── scales ──
  const rtl = dir === "rtl";
  const plotStart = LABEL_SIDE;
  const plotWidth = Math.max(width - LABEL_SIDE - FAR_SIDE, 1);
  const yMax = Math.max(total, ...running, 1) * 1.08;
  const flip = (x: number) => (rtl ? width - x : x); // mirror for right-to-left
  const x = (index: number) => flip(plotStart + (count > 1 ? index / (count - 1) : 0) * plotWidth);
  const y = (value: number) => TOP + PLOT_HEIGHT - (value / yMax) * PLOT_HEIGHT;
  const baseline = y(0);

  const linePath = running.map((value, i) => `${i ? "L" : "M"}${x(i)},${y(value)}`).join("");
  const areaPath = running.length
    ? `${linePath}L${x(last)},${baseline}L${x(0)},${baseline}Z`
    : "";
  const yTicks = [0, total / 2, total];
  const xTicks = [0, 7, 14, 21, count - 1].filter((i) => i < count);

  // ── hover & keyboard ──
  const lastSelectable = running.length ? last : count - 1;
  function pick(clientX: number) {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const fromStart = rtl ? box.right - clientX - plotStart : clientX - box.left - plotStart;
    const index = Math.round((fromStart / plotWidth) * (count - 1));
    setActive(Math.min(Math.max(index, 0), lastSelectable));
  }
  function onKeyDown(event: React.KeyboardEvent) {
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    if (event.key !== forward && event.key !== back) return;
    event.preventDefault();
    setActive((current) => {
      const from = current ?? lastSelectable;
      return Math.min(Math.max(from + (event.key === forward ? 1 : -1), 0), lastSelectable);
    });
  }

  const tooltipLeft = active === null ? 0 : Math.min(Math.max(x(active), 80), width - 80);

  return (
    <div>
      {/* Legend: line keys, like the marks they name */}
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full bg-pine" aria-hidden />
          {t.insights.yourSpending}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full bg-muted/60" aria-hidden />
          {t.insights.evenPace}
        </span>
      </div>

      {running.length > 0 && (
        <p className="sr-only">{t.insights.chartSummary(format(running[last]), format(evenAt(last)))}</p>
      )}

      <div
        ref={boxRef}
        className="relative touch-pan-y rounded-2xl outline-offset-4"
        style={{ height: TOP + PLOT_HEIGHT + AXIS_BAND }}
        tabIndex={0}
        role="group"
        aria-label={t.insights.paceTitle}
        onPointerMove={(event) => pick(event.clientX)}
        onPointerDown={(event) => pick(event.clientX)}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(lastSelectable)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        {width > 0 && (
          // Positions are mirrored by flip(). Text anchors are NOT: in an Arabic page the
          // browser already reads "start"/"end" from the right, so they mirror by themselves.
          <svg width={width} height={TOP + PLOT_HEIGHT + AXIS_BAND} aria-hidden className="block">
            {/* grid: solid hairlines, recessive */}
            {yTicks.map((value) => (
              <g key={value}>
                <line
                  x1={flip(plotStart)}
                  x2={flip(plotStart + plotWidth)}
                  y1={y(value)}
                  y2={y(value)}
                  stroke="var(--color-line)"
                  strokeWidth={1}
                />
                <text
                  x={flip(plotStart - 8)}
                  y={y(value)}
                  dy="0.32em"
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--color-muted)"
                  className="tabular"
                >
                  {compact(value)}
                </text>
              </g>
            ))}
            {xTicks.map((index) => (
              <text
                key={index}
                x={x(index)}
                y={TOP + PLOT_HEIGHT + 18}
                textAnchor={index === 0 ? "start" : index === count - 1 ? "end" : "middle"}
                fontSize={11}
                fill="var(--color-muted)"
              >
                {shortDate(days[index].day)}
              </text>
            ))}

            {/* even pace: grey context line from 0 to the budget */}
            <line
              x1={x(0)}
              y1={y(evenAt(0))}
              x2={x(count - 1)}
              y2={y(total)}
              stroke="var(--color-muted)"
              strokeOpacity={0.6}
              strokeWidth={1.5}
              strokeLinecap="round"
            />

            {/* the student's running total */}
            {areaPath && <path d={areaPath} fill="var(--color-pine)" fillOpacity={0.1} />}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="var(--color-pine)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* crosshair */}
            {active !== null && (
              <line
                x1={x(active)}
                x2={x(active)}
                y1={TOP - 8}
                y2={baseline}
                stroke="var(--color-ink)"
                strokeOpacity={0.35}
                strokeWidth={1}
              />
            )}

            {/* end dot with a surface ring, and one direct label: today's total */}
            {running.length > 0 && (
              <>
                <circle
                  cx={x(active !== null && active <= last ? active : last)}
                  cy={y(running[active !== null && active <= last ? active : last])}
                  r={4.5}
                  fill="var(--color-pine)"
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
                {active === null && (
                  <text
                    x={x(last)}
                    y={y(running[last]) - 12}
                    textAnchor={last > count * 0.75 ? "end" : "middle"}
                    fontSize={12}
                    fontWeight={600}
                    fill="var(--color-ink)"
                  >
                    {format(running[last])}
                  </text>
                )}
              </>
            )}
          </svg>
        )}

        {/* tooltip: value first, label second */}
        {active !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-40 -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-lg"
            style={{ left: tooltipLeft }}
            role="status"
          >
            <p className="text-xs text-muted">{shortDate(days[active].day)}</p>
            {active <= last && (
              <>
                <p className="mt-1 flex items-center gap-2">
                  <span className="h-0.5 w-3 shrink-0 rounded-full bg-pine" aria-hidden />
                  <span className="font-semibold">{format(running[active])}</span>
                </p>
                <p className="text-xs text-muted">{t.insights.spentByThisDay}</p>
                <p className="mt-1 text-xs text-muted">{t.insights.onThisDay(format(Number(days[active].spent)))}</p>
              </>
            )}
            <p className="mt-1 flex items-center gap-2 text-xs text-muted">
              <span className="h-0.5 w-3 shrink-0 rounded-full bg-muted/60" aria-hidden />
              {t.insights.evenPaceValue(format(evenAt(active)))}
            </p>
          </div>
        )}
      </div>

      {/* The same numbers without hovering (screen readers, keyboard, or just reading) */}
      {running.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted hover:text-ink">{t.insights.showTable}</summary>
          <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-line">
            <table className="tabular w-full text-start">
              <thead className="sticky top-0 bg-surface text-muted">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">{t.insights.day}</th>
                  <th className="px-3 py-2 text-end font-medium">{t.insights.thatDay}</th>
                  <th className="px-3 py-2 text-end font-medium">{t.insights.soFar}</th>
                  <th className="px-3 py-2 text-end font-medium">{t.insights.evenPace}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {running.map((value, i) => (
                  <tr key={days[i].day}>
                    <td className="px-3 py-1.5">{shortDate(days[i].day)}</td>
                    <td className="px-3 py-1.5 text-end">{format(Number(days[i].spent))}</td>
                    <td className="px-3 py-1.5 text-end font-semibold">{format(value)}</td>
                    <td className="px-3 py-1.5 text-end text-muted">{format(evenAt(i))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
