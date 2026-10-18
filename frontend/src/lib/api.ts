import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import type { TokenResponse } from "@/types/api";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

// The access token lives in memory only (never localStorage), so injected scripts
// cannot read it. A page reload gets a new one from the httpOnly refresh cookie.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

const sessionExpiredListeners = new Set<() => void>();

/** Called when the session cannot be renewed (refresh cookie missing or revoked). */
export function onSessionExpired(listener: () => void) {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // send the refresh-token cookie to /auth endpoints
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Single-flight refresh: if ten requests fail with 401 at the same moment, only ONE
// refresh call is made and all ten wait for it. Two parallel refresh calls would send
// the same refresh token twice, and the backend treats reuse as theft.
let refreshInFlight: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= api
    .post<TokenResponse>("/auth/refresh")
    .then((response) => {
      setAccessToken(response.data.access_token);
      return response.data.access_token;
    })
    .catch(() => {
      setAccessToken(null);
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

const AUTH_ENDPOINTS = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
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
