import { useId } from "react";

/**
 * The Budget Analysis logo: three bars and a coin, then the name on two lines.
 * Drawn as SVG (not a picture) so it stays sharp at any size and follows the theme:
 * the navy parts use the `logo` colour, which turns light in dark mode. The "$" and the
 * lines on the coin stay navy in both themes, because they sit on the green coin.
 */
export function LogoMark({ className = "h-9 w-auto" }: { className?: string }) {
  const gap = useId(); // a page can show the logo twice; mask ids must be unique
  return (
    <svg viewBox="0 0 280 228" className={`text-logo ${className}`} aria-hidden>
      <defs>
        <mask id={gap}>
          <rect width="280" height="228" fill="#fff" />
          {/* The white ring between the bars and the coin. */}
          <circle cx="208" cy="160" r="78" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${gap})`}>
        <rect x="3" y="121" width="57" height="104" fill="currentColor" />
        <rect x="58" y="210" width="24" height="15" fill="currentColor" />
        <rect x="80" y="62" width="58" height="163" fill="currentColor" />
        <rect x="157" y="4" width="58" height="150" fill="#13b375" />
      </g>
      <circle cx="208" cy="160" r="66" fill="currentColor" />
      <circle cx="208" cy="160" r="49" fill="#13b375" />
      <g fill="none" stroke="#05194b" strokeWidth="5.5" strokeLinecap="round">
        <path d="M 172.4 166.3 A 36 36 0 0 1 210.5 124.1" />
        <path d="M 243.6 153.7 A 36 36 0 0 1 205.5 195.9" />
      </g>
      <path
        fill="#05194b"
        d="M208 133v6c-9 1-15 6-15 13 0 8 6 11 14 13 7 2 10 3 10 7 0 4-4 6-9 6-6 0-10-3-11-7l-7 2c1 6 7 11 14 12v6h6v-6c9-1 15-6 15-13 0-8-6-11-14-13-7-2-10-3-10-7 0-3 4-6 8-6 5 0 8 3 9 6l7-2c-2-6-7-10-13-11v-6z"
      />
    </svg>
  );
}

/** Mark and name together. Always left to right: it is a name, not a sentence. */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <span className="inline-flex items-center gap-2.5" dir="ltr">
      <LogoMark className={big ? "h-11 w-auto" : "h-9 w-auto"} />
      <span className={`font-logo leading-[0.95] text-logo ${big ? "text-[19px]" : "text-[16px]"}`}>
        <span className="block font-bold tracking-tight">Budget</span>
        <span className="block font-normal">Analysis</span>
      </span>
      <span className="sr-only">Budget Analysis</span>
    </span>
  );
}
