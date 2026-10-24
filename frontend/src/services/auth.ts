import { api, setAccessToken } from "@/lib/api";
import type { Currency, Locale, TokenResponse, User } from "@/types/api";

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
  base_currency: Currency;
  locale: Locale;
}

export async function login(email: string, password: string): Promise<void> {
  const { data } = await api.post<TokenResponse>("/auth/login", { email, password });
  setAccessToken(data.access_token);
}

export async function register(input: RegisterInput): Promise<void> {
  const { data } = await api.post<TokenResponse>("/auth/register", input);
  setAccessToken(data.access_token);
}

export interface AuthConfig {
  google_client_id: string | null;
  email_enabled: boolean; // false: no "forgot password" and no "confirm your email" yet
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
): Promise<void> {
  const { data } = await api.post<TokenResponse>("/auth/google", { credential, ...newAccount });
  setAccessToken(data.access_token);
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
  changes: Partial<Pick<User, "full_name" | "base_currency" | "secondary_currency" | "locale">>,
): Promise<User> {
  const { data } = await api.patch<User>("/users/me", changes);
  return data;
}
