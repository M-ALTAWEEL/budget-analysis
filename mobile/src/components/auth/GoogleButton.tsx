import { useState } from "react";
import { View } from "react-native";

import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthConfig } from "@/components/auth/useAuthConfig";
import { FormError } from "@/components/ui/Field";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { useTheme } from "@/theme/ThemeProvider";
import type { Currency } from "@/types/api";

// The native Google sign-in (phase 6). Loaded carefully: an app built before it was added
// has no native module, and then the button simply isn't shown.
type GoogleModule = typeof import("@react-native-google-signin/google-signin");
let google: GoogleModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  google = require("@react-native-google-signin/google-signin") as GoogleModule;
} catch {
  google = null;
}

let configuredFor: string | null = null;

/**
 * Google's own "Sign in with Google" button, like the website's. The ID token it returns
 * is issued for the website's client ID (`webClientId`), so the server checks it exactly
 * like a sign-in on the website. Hidden when the server has no Google client ID.
 *
 * `onCredential`: instead of signing in, hand the token over (to confirm "is it you?").
 */
export function GoogleButton({
  currency = "TRY",
  onCredential,
}: {
  currency?: Currency;
  onCredential?: (credential: string) => Promise<void>;
}) {
  const { locale } = useI18n();
  const { dark } = useTheme();
  const config = useAuthConfig();
  const { loginWithGoogle } = useAuth();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientId = config.data?.google_client_id;
  if (!google || !clientId) return null;
  const { GoogleSignin, GoogleSigninButton, isErrorWithCode, isSuccessResponse, statusCodes } = google;

  async function signIn() {
    setError(null);
    setBusy(true);
    try {
      if (configuredFor !== clientId) {
        GoogleSignin.configure({ webClientId: clientId! });
        configuredFor = clientId!;
      }
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Forget the last choice, so the person can pick another Google account.
      await GoogleSignin.signOut().catch(() => undefined);
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return; // closed the account picker
      const credential = response.data.idToken;
      if (!credential) throw new Error("no ID token");
      if (onCredential) await onCredential(credential);
      else await loginWithGoogle(credential, { base_currency: currency, locale });
    } catch (err) {
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) return;
      if (isErrorWithCode(err) && err.code === statusCodes.IN_PROGRESS) return;
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <GoogleSigninButton
        style={{ width: "100%", height: 48 }}
        size={GoogleSigninButton.Size.Wide}
        color={dark ? GoogleSigninButton.Color.Dark : GoogleSigninButton.Color.Light}
        disabled={busy}
        onPress={() => void signIn()}
      />
      <FormError message={error} />
    </View>
  );
}
