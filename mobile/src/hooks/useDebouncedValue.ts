"use client";

import { useEffect, useState } from "react";

/** `value`, but only after it stopped changing for `delay` ms (e.g. the user paused typing). */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
