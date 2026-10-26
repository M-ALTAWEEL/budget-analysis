import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { LockKeyhole } from "lucide-react-native";
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Logo";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useColors } from "@/theme/ThemeProvider";

// Set by the root layout: was the session restored when the app opened (lock it), or did
// the person just sign in with their password (they proved who they are: don't ask again)?
let restoredAtLaunch = false;
export function setRestoredAtLaunch(value: boolean) {
  restoredAtLaunch = value;
}

const KEY = "bb.app-lock"; // on this phone only: another phone asks again
const GRACE_MS = 30_000; // a quick trip to another app (to copy a code) doesn't lock

type LockValue = {
  enabled: boolean;
  /** Turning it on asks once, so nobody locks themselves out by mistake. */
  setEnabled: (on: boolean) => Promise<boolean>;
};
const LockContext = createContext<LockValue | null>(null);

/** Can this phone check it's the owner? (Face ID, a fingerprint, or at least a passcode.) */
export async function canLock(): Promise<boolean> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

async function confirmOwner(reason: string): Promise<boolean> {
  try {
    // The phone's passcode is allowed as a fallback: a failed fingerprint must not
    // lock someone out of their own budget.
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: reason, disableDeviceFallback: false });
    return result.success;
  } catch {
    return false;
  }
}

/**
 * Locks the signed-in app with Face ID / a fingerprint / the passcode: when it opens,
 * and when it comes back after more than 30 seconds away. While the phone shows the list
 * of open apps, a cover hides the amounts.
 */
export function AppLock({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const [covered, setCovered] = useState(false);
  const [ready, setReady] = useState(false);
  const leftAt = useRef<number | null>(null);
  const asking = useRef(false);

  const unlock = useCallback(async () => {
    if (asking.current) return;
    asking.current = true;
    const ok = await confirmOwner(t.lock.reason);
    asking.current = false;
    if (ok) setLocked(false);
  }, [t.lock.reason]);

  // Opening the app: locked from the first frame, so nothing shows before the check.
  // Right after signing in with a password it isn't: that already proved who it is.
  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((saved) => {
        const on = saved === "on";
        setEnabledState(on);
        setLocked(on && restoredAtLaunch);
        restoredAtLaunch = false; // signing out and in again later is a fresh sign-in
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready && locked) void unlock();
  }, [ready, locked, unlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (!enabled) return;
      if (state !== "active") {
        setCovered(true);
        // The Face ID sheet itself makes the app "inactive": that is not leaving.
        if (state === "background" && leftAt.current === null) leftAt.current = Date.now();
        return;
      }
      setCovered(false);
      if (leftAt.current !== null && Date.now() - leftAt.current > GRACE_MS) setLocked(true);
      leftAt.current = null;
    });
    return () => subscription.remove();
  }, [enabled]);

  const setEnabled = useCallback(
    async (on: boolean) => {
      if (on && !(await confirmOwner(t.lock.reason))) return false;
      await SecureStore.setItemAsync(KEY, on ? "on" : "off").catch(() => undefined);
      setEnabledState(on);
      return true;
    },
    [t.lock.reason],
  );

  return (
    <LockContext value={{ enabled, setEnabled }}>
      {children}
      {(!ready || locked || covered) && <LockScreen showButton={ready && locked && !covered} onUnlock={() => void unlock()} />}
    </LockContext>
  );
}

export function useAppLock(): LockValue {
  const context = use(LockContext);
  if (!context) throw new Error("useAppLock must be used inside <AppLock>");
  return context;
}

function LockScreen({ showButton, onUnlock }: { showButton: boolean; onUnlock: () => void }) {
  const { t } = useI18n();
  const colors = useColors();
  return (
    <View
      accessibilityViewIsModal
      style={{ position: "absolute", inset: 0, zIndex: 100, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", gap: 20, padding: 32 }}>
      <LogoMark height={64} />
      {showButton && (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <LockKeyhole size={18} color={colors.muted} />
            <Text weight="semibold">{t.lock.locked}</Text>
          </View>
          <Button onPress={onUnlock} style={{ minWidth: 200 }}>{t.lock.unlock}</Button>
        </>
      )}
    </View>
  );
}
