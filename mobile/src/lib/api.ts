/**
 * The app's HTTP client: the same interface as the website's (frontend/src/lib/api.ts),
 * so every file in services/ is shared as it is (scripts/sync-shared.mjs).
 *
 * The one difference is where the refresh token lives:
 * - website: an httpOnly cookie the browser sends by itself;
 * - app: the phone's secure storage (iOS Keychain, Android Keystore; threat I4). The API
 *   puts it in the answer for the app (backend `ClientInfo.native`), and this file keeps
 *   it and sends it back on /auth/refresh and /auth/logout. The services never see it.
 *
 * The access token lives in memory only (15 minutes).
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { TokenResponse } from "@/types/api";

// Until the stores (phase 8): the staging API, directly. Not through the staging website:
// Vercel protects preview sites with its own sign-in, which a phone can't pass (401).
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://budget-analysis-api-staging.onrender.com/api/v1";

/** The website, for pages the app opens in the browser (terms, privacy). */
export const WEBSITE_URL = process.env.EXPO_PUBLIC_WEBSITE_URL ?? "https://budgetanalysis.vercel.app";

const REFRESH_KEY = "bb.refresh-token";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

const sessionExpiredListeners = new Set<() => void>();

/** Called when the session can't be renewed (signed out elsewhere, expired, reused). */
export function onSessionExpired(listener: () => void) {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 70_000, // the free staging server can take most of a minute to wake up
  // Tells the API this is the app: the refresh token comes in the answer, not a cookie.
  headers: { "X-Client": Platform.OS === "ios" ? "ios" : "android" },
});

const usesRefreshToken = (url = "") => url.startsWith("/auth/refresh") || url.startsWith("/auth/logout");

api.interceptors.request.use(async (config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (usesRefreshToken(config.url) && config.data === undefined) {
    const stored = await SecureStore.getItemAsync(REFRESH_KEY);
    if (stored) config.data = { refresh_token: stored };
  }
  return config;
});

// Every sign-in, refresh and 2FA answer may carry a new refresh token: keep it.
api.interceptors.response.use(async (response) => {
  const token = (response.data as { refresh_token?: unknown } | undefined)?.refresh_token;
  if (typeof token === "string" && token) await SecureStore.setItemAsync(REFRESH_KEY, token);
  if (response.config.url?.startsWith("/auth/logout")) await forgetRefreshToken();
  return response;
});

async function forgetRefreshToken() {
  await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => undefined);
}

// Single-flight refresh, like the website: ten requests failing at once share ONE refresh,
// because sending the same rotating refresh token twice looks like theft to the API.
let refreshInFlight: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= api
    .post<TokenResponse>("/auth/refresh")
    .then((response) => {
      setAccessToken(response.data.access_token);
      return response.data.access_token;
    })
    .catch(async (error: AxiosError) => {
      setAccessToken(null);
      // 401: this refresh token is finished. Anything else (offline): keep it for later.
      if (error.response?.status === 401) await forgetRefreshToken();
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

// A 401 from these means "wrong", not "session expired": no refresh-and-retry for them.
const AUTH_ENDPOINTS = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
  "/auth/2fa/verify",
  "/auth/phone/send",
  "/auth/phone/verify",
];

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    if (original?.url?.startsWith("/auth/logout")) await forgetRefreshToken();
    const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => original?.url?.startsWith(path));

    if (error.response?.status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true; // retry once only, never loop
      const token = await refreshAccessToken();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      sessionExpiredListeners.forEach((listener) => listener());
    }
    return Promise.reject(error);
  },
);
