"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { BRAND, MARK_BAR_RADIUS, MARK_BARS, MARK_COIN, MARK_VIEWBOX } from "@/lib/brand";

export type LoaderVariant = "onLight" | "onBrand" | "inherit";

/**
 * The site's loading indicator ("fill up"), the app's IbudgiLoader in SVG and CSS
 * (app/brand.css): the bars fill from the bottom one after the other, then the coin pops.
 * `size` is the width in px: 48 by default, 24 in buttons and rows, 72 for a whole page.
 * `onLight` is indigo (white in dark mode), `onBrand` white, `inherit` the text colour.
 */
export function IbudgiLoader({
  size = 48,
  variant = "onLight",
  label,
}: {
  size?: number;
  variant?: LoaderVariant;
  label?: string;
}) {
  const { t } = useI18n();
  const tone = variant === "onBrand" ? " ib-loader--brand" : variant === "inherit" ? " ib-loader--inherit" : "";
  return (
    <svg
      viewBox={`${MARK_VIEWBOX.x} ${MARK_VIEWBOX.y} ${MARK_VIEWBOX.width} ${MARK_VIEWBOX.height}`}
      width={size}
      height={(size * MARK_VIEWBOX.height) / MARK_VIEWBOX.width}
      className={`ib-loader shrink-0${tone}`}
      role="progressbar"
      aria-label={label ?? t.common.loading}
    >
      {MARK_BARS.map((bar, i) => (
        <g key={bar.x}>
          <rect className="ib-loader__track" {...bar} rx={MARK_BAR_RADIUS} fill="currentColor" />
          <rect className={`ib-loader__fill ib-loader__f${i + 1}`} {...bar} rx={MARK_BAR_RADIUS} fill="currentColor" />
        </g>
      ))}
      <circle className="ib-loader__coin" {...MARK_COIN} fill={BRAND.coral} />
    </svg>
  );
}
