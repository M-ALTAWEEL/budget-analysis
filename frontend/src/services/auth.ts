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
