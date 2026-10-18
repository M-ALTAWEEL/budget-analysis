"use client";

import { Check } from "lucide-react";

import { COLOR_CHOICES, IconGlyph } from "@/components/ui/CategoryIcon";

/** Icon grid + colour swatches, shared by the category and savings-goal forms. */
export function IconColorPicker({
  icons,
  icon,
  onIcon,
  color,
  onColor,
  iconLabel,
  colorLabel,
}: {
  icons: string[];
  icon: string;
  onIcon: (icon: string) => void;
  color: string;
  onColor: (color: string) => void;
  iconLabel: string;
  colorLabel: string;
}) {
  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{iconLabel}</legend>
        <div role="radiogroup" className="grid grid-cols-8 gap-1.5">
          {icons.map((choice) => {
            const selected = choice === icon;
            return (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={choice.replace(/-/g, " ")}
                onClick={() => onIcon(choice)}
                className={`flex aspect-square items-center justify-center rounded-lg border transition-colors ${
                  selected
                    ? "border-pine bg-pine-soft text-pine-dark ring-1 ring-pine"
                    : "border-line text-muted hover:text-ink"
                }`}
              >
                <IconGlyph name={choice} className="size-5" />
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{colorLabel}</legend>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {COLOR_CHOICES.map((choice) => {
            const selected = choice === color;
            return (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={choice}
                onClick={() => onColor(choice)}
                className={`flex size-9 items-center justify-center rounded-full ${
                  selected ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
                }`}
                style={{ backgroundColor: choice }}
              >
                {selected && <Check className="size-4 text-white" aria-hidden />}
              </button>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}
