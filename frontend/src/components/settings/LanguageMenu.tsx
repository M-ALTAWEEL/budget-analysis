"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Flag } from "@/components/ui/Flag";
import { LOCALES, LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";

import { useChangeLocale } from "./useChangeLocale";

/** Compact language picker for the top of the sign-in screens. */
export function LanguageMenu() {
  const { locale, t } = useI18n();
  const changeLocale = useChangeLocale();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on a click outside or on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t.settings.language}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm hover:border-ink/30"
      >
        <Flag code={LOCALE_INFO[locale].flag} />
        <span>{LOCALE_INFO[locale].label}</span>
        <ChevronDown className="size-4 text-muted" aria-hidden />
      </button>
      {open && (
        <ul
          id={menuId}
          className="absolute end-0 z-40 mt-2 w-44 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg"
        >
          {LOCALES.map((code) => (
            <li key={code}>
              <button
                type="button"
                lang={code}
                onClick={() => {
                  setOpen(false);
                  void changeLocale(code);
                }}
                aria-current={code === locale ? "true" : undefined}
                className="flex w-full items-center gap-3 px-3 py-2 text-start text-sm hover:bg-ink/5"
              >
                <Flag code={LOCALE_INFO[code].flag} />
                <span className="flex-1">{LOCALE_INFO[code].label}</span>
                {code === locale && <Check className="size-4 text-pine" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
