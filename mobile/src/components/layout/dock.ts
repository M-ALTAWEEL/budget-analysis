import { useEffect, useState } from "react";
import { Keyboard } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** The dock (66) floats 12 above the safe area; content that ends at the bottom clears it. */
const DOCK_CLEARANCE = 90;

/** True while the keyboard is open: the dock hides, so a text box can sit on the keyboard. */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => setOpen(true));
    const hidden = Keyboard.addListener("keyboardDidHide", () => setOpen(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return open;
}

/** Space to leave under bottom-pinned content on tab screens (none while typing). */
export function useDockSpace(): number {
  const insets = useSafeAreaInsets();
  return useKeyboardOpen() ? 0 : insets.bottom + DOCK_CLEARANCE;
}
