import { api, setAccessToken } from "@/lib/api";
import type { Currency, Locale, TokenResponse, TwoFactorChallenge, User } from "@/types/api";

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
  base_currency: Currency;
  locale: Locale;
}

/** Signed in, or the 2FA challenge when a code is needed next (then: verifyTwoFactor). */
function signedInOrChallenge(data: TokenResponse | TwoFactorChallenge): string | null {
  if ("two_factor_required" in data) return data.challenge;
  setAccessToken(data.access_token);
  return null;
}

export async function login(email: string, password: string): Promise<string | null> {
  const { data } = await api.post<TokenResponse | TwoFactorChallenge>("/auth/login", {
    email,
    password,
  });
  return signedInOrChallenge(data);
}

export async function sendPhoneCode(phone: string, locale: Locale): Promise<void> {
  await api.post("/auth/phone/send", { phone, locale });
}

/** Signs in with the SMS code (the first time, it creates the account). */
export async function verifyPhoneCode(
  phone: string,
  code: string,
  newAccount: Pick<RegisterInput, "base_currency" | "locale">,
): Promise<string | null> {
  const { data } = await api.post<TokenResponse | TwoFactorChallenge>("/auth/phone/verify", {
    phone,
    code,
    ...newAccount,
  });
  return signedInOrChallenge(data);
}

export async function verifyTwoFactor(challenge: string, code: string): Promise<void> {
  const { data } = await api.post<TokenResponse>("/auth/2fa/verify", { challenge, code });
  setAccessToken(data.access_token);
}

export async function register(input: RegisterInput): Promise<void> {
  const { data } = await api.post<TokenResponse>("/auth/register", input);
  setAccessToken(data.access_token);
}

export interface AuthConfig {
  google_client_id: string | null;
  email_enabled: boolean; // false: no "forgot password" and no "confirm your email" yet
  two_factor_available: boolean; // false: the server can't protect 2FA keys yet
  phone_enabled: boolean; // false: no SMS here yet, "Continue with phone" is hidden
  phone_countries: string[]; // ISO codes that can receive codes
}

/** Which sign-in options the server has turned on. */
export async function getAuthConfig(): Promise<AuthConfig> {
  const { data } = await api.get<AuthConfig>("/auth/config");
  return data;
}

// ── email links and passwords ──────────────────────────────────────────────

export async function sendVerificationEmail(): Promise<void> {
  await api.post("/auth/verify-email/send");
}

export async function verifyEmail(token: string): Promise<void> {
  await api.post("/auth/verify-email", { token });
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post("/auth/password/forgot", { email });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post("/auth/password/reset", { token, password });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post("/auth/password/change", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

/** `credential` is the ID token Google gave the browser. The server checks it with Google. */
export async function googleSignIn(
  credential: string,
  newAccount: Pick<RegisterInput, "base_currency" | "locale">,
): Promise<string | null> {
  const { data } = await api.post<TokenResponse | TwoFactorChallenge>("/auth/google", {
    credential,
    ...newAccount,
  });
  return signedInOrChallenge(data);
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } finally {
    setAccessToken(null); // forget the token even if the request fails
  }
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>("/users/me");
  return data;
}

export async function updateMe(
  changes: Partial<
    Pick<User, "full_name" | "username" | "base_currency" | "secondary_currency" | "locale">
  >,
): Promise<User> {
  const { data } = await api.patch<User>("/users/me", changes);
  return data;
}

// ── sensitive actions (they need a recent sign-in, see isReauthRequired) ───

/** True when the server wants "is it you?" first (403 reauth_required). */
export function isReauthRequired(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: unknown } }).response;
  if (response?.status !== 403) return false;
  const data = response.data;
  // A download asks for a Blob, so the JSON body arrives as one: 403 is enough there.
  return data instanceof Blob || (data as { detail?: unknown })?.detail === "reauth_required";
}

export async function reauthenticate(proof: { password: string } | { credential: string }): Promise<void> {
  await api.post("/auth/reauth", proof);
}

export async function changeEmail(newEmail: string): Promise<void> {
  await api.post("/auth/email/change", { new_email: newEmail });
}

export async function confirmEmailChange(token: string): Promise<void> {
  await api.post("/auth/email/confirm", { token });
}

export async function deleteAccount(): Promise<void> {
  await api.delete("/me");
}

/** Everything the account holds, as a ZIP (made on the server now, not stored there). */
export async function exportData(): Promise<Blob> {
  const { data } = await api.get<Blob>("/me/export", { responseType: "blob" });
  return data;
}

// ── two-factor authentication ───────────────────────────────────────────────

export interface TwoFactorSetup {
  secret: string;
  otpauth_uri: string;
  qr_svg: string; // data: URI
}

export async function twoFactorStatus(): Promise<{ enabled: boolean; backup_codes_left: number }> {
  const { data } = await api.get<{ enabled: boolean; backup_codes_left: number }>("/me/2fa");
  return data;
}

export async function setupTwoFactor(): Promise<TwoFactorSetup> {
  const { data } = await api.post<TwoFactorSetup>("/me/2fa/setup");
  return data;
}

export async function enableTwoFactor(code: string): Promise<string[]> {
  const { data } = await api.post<{ codes: string[] }>("/me/2fa/enable", { code });
  return data.codes;
}

export async function disableTwoFactor(): Promise<void> {
  await api.post("/me/2fa/disable");
}

export async function newBackupCodes(): Promise<string[]> {
  const { data } = await api.post<{ codes: string[] }>("/me/2fa/backup-codes");
  return data.codes;
}
