/**
 * The website's shape and motion tokens (frontend/src/app/globals.css): the same corners,
 * shadows and curves, so a card or a switch feels the same in both.
 */
import { Easing } from "react-native-reanimated";

/** Cards, tiles inside cards, and buttons and fields. Bars are full pills (height / 2). */
export const RADIUS = { card: 24, tile: 18, control: 14 } as const;

/** Card on the page, and what floats (the dock, menus, sheets). Use as `boxShadow`. */
export function elevation(dark: boolean) {
  return dark
    ? {
        card: "inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 14px 34px -22px rgba(0, 0, 0, 0.6)",
        float: "0 24px 48px -16px rgba(0, 0, 0, 0.7)",
      }
    : {
        card: "0 1px 2px rgba(21, 23, 42, 0.04), 0 14px 34px -18px rgba(58, 54, 219, 0.22)",
        float: "0 2px 6px rgba(21, 23, 42, 0.06), 0 24px 48px -20px rgba(21, 23, 42, 0.28)",
      };
}

/** ease-smooth for most changes, ease-spring for a small overshoot (a switch, a pressed tile). */
export const EASE = {
  smooth: Easing.bezier(0.2, 0.8, 0.2, 1),
  spring: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;
