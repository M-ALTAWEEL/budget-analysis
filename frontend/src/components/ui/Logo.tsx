import { BRAND, LOGO, MARK_BAR_RADIUS, MARK_BARS, MARK_COIN, WORDMARK } from "@/lib/brand";

/** The ibudgi icon: the indigo tile with the white bars and the coral coin. */
function Tile() {
  return (
    <>
      <rect width="100" height="100" rx={LOGO.tileRadius} fill={BRAND.indigo} />
      <g transform={LOGO.markTransform}>
        {MARK_BARS.map((bar) => (
          <rect key={bar.x} {...bar} rx={MARK_BAR_RADIUS} fill={BRAND.white} />
        ))}
        <circle {...MARK_COIN} fill={BRAND.coral} />
      </g>
    </>
  );
}

/** The icon on its own (the brand kit's ibudgi-icon.svg). */
export function LogoMark({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <Tile />
    </svg>
  );
}

/**
 * The ibudgi logo (the kit's ibudgi-logo.svg), drawn inline: the name uses the `logo`
 * colour, brand ink in light mode and white in dark mode (ibudgi-logo-white.svg).
 * Always left to right: it is a name, not a sentence.
 */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <svg
      viewBox={`0 0 ${LOGO.width} ${LOGO.height}`}
      className={`w-auto text-logo ${size === "lg" ? "h-11" : "h-9"}`}
      role="img"
      aria-label="ibudgi"
    >
      <Tile />
      <path transform={LOGO.wordmarkTransform} d={WORDMARK.d} fill="currentColor" />
    </svg>
  );
}
