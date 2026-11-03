"use client";

import { useId } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

/**
 * A pill switch between a few options; a white thumb slides to the chosen one.
 * Radio buttons underneath, so arrow keys and screen readers work as for any radio group.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string; // for screen readers
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative inline-grid rounded-full border border-line bg-sunken p-[3px] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-[3px] start-[3px] translate-x-(--seg-x) rounded-full bg-surface shadow-[0_1px_3px_rgb(21_23_42/0.14)] motion-safe:transition-transform motion-safe:duration-350 motion-safe:ease-spring rtl:-translate-x-(--seg-x)"
        style={
          {
            width: `calc((100% - 6px) / ${options.length})`,
            "--seg-x": `${index * 100}%`,
          } as React.CSSProperties
        }
      />
      {options.map((option) => (
        <label
          key={option.value}
          className={`relative z-1 inline-flex cursor-pointer items-center justify-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
            option.value === value ? "text-ink" : "text-muted hover:text-ink"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.icon}
          {option.label}
        </label>
      ))}
    </div>
  );
}
