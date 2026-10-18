"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/**
 * `value`, but when it changes the number runs from the old value to the new one
 * (an expense added: "left to spend" visibly goes down). The first value is shown as is,
 * and people who ask their system for less motion get the new number at once.
 */
export function useCountUp(value: number, duration = 0.8): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      from.current = value;
      return;
    }
    if (from.current === value) return;
    const controls = animate(from.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        from.current = latest;
        setShown(latest);
      },
    });
    return () => controls.stop();
  }, [value, duration, reduceMotion]);

  return reduceMotion ? value : shown;
}
