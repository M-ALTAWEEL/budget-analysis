import { useId } from "react";

// Inline SVG flags. Emoji flags (🇸🇦) are not an option: Windows has no flag emoji
// and shows the letters "SA" instead. SVG looks the same on every system and needs
// no extra request. Decorative only: the language name is always written next to it.

type Code = "gb" | "sa" | "tr";

export function Flag({ code, className = "" }: { code: Code; className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgb(0_0_0/0.12)] ${className}`}
      aria-hidden
    >
      {code === "gb" ? <UnitedKingdom /> : code === "sa" ? <SaudiArabia /> : <Turkey />}
    </span>
  );
}

const svgProps = { className: "size-full", preserveAspectRatio: "xMidYMid slice" } as const;

function UnitedKingdom() {
  // ids must be unique when several flags are on the same page
  const id = useId();
  return (
    <svg viewBox="0 0 60 30" {...svgProps}>
      <clipPath id={`${id}s`}>
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id={`${id}t`}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath={`url(#${id}s)`}>
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${id}t)`} stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

function Turkey() {
  return (
    <svg viewBox="0 0 1200 800" {...svgProps}>
      <rect width="1200" height="800" fill="#E30A17" />
      <circle cx="425" cy="400" r="200" fill="#fff" />
      <circle cx="475" cy="400" r="160" fill="#E30A17" />
      <polygon
        fill="#fff"
        points="583.334,400 764.235,458.779 652.431,304.894 652.431,495.106 764.235,341.221"
      />
    </svg>
  );
}

function SaudiArabia() {
  // Simplified at this size: the shahada and the sword under it.
  return (
    <svg viewBox="0 0 300 200" {...svgProps}>
      <rect width="300" height="200" fill="#006C35" />
      <text
        x="150"
        y="98"
        fill="#fff"
        fontSize="34"
        textAnchor="middle"
        fontFamily="'Amiri', 'Traditional Arabic', serif"
        direction="rtl"
      >
        لا إله إلا الله محمد رسول الله
      </text>
      <path d="M62 134 L80 128 H226 V140 H80 Z" fill="#fff" />
      <rect x="226" y="122" width="6" height="24" rx="2" fill="#fff" />
      <rect x="232" y="131" width="14" height="6" rx="2" fill="#fff" />
    </svg>
  );
}
