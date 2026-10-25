"use client";

import { isAxiosError } from "axios";
import { useCallback } from "react";

import { useI18n } from "@/i18n/I18nProvider";
import type { Messages } from "@/i18n/messages/en";

const FIELD_NAMES: Record<string, string> = {
  email: "Email",
  password: "Password",
  full_name: "Name",
  amount: "Amount",
  total_amount: "Budget",
  limit_amount: "Limit",
  description: "Description",
  spent_at: "Date",
  currency: "Currency",
  name: "Name",
};

/** What a status code means in general. Screens can be more specific with `overrides`. */
function byStatus(status: number, t: Messages): string {
  if (status === 401) return t.errors.invalidLogin;
  if (status === 403) return t.errors.forbidden;
  if (status === 404) return t.errors.notFound;
  if (status === 400 || status === 422) return t.errors.invalid;
  if (status === 429) return t.errors.tooMany;
  if (status >= 500) return t.errors.server;
  return t.errors.generic;
}

/** English: the backend's own sentence (FastAPI writes in English, and it is the most
 *  precise). Arabic and Turkish: a translated sentence chosen by the status code. */
function describe(
  error: unknown,
  t: Messages,
  english: boolean,
  overrides: Partial<Record<number, string>>,
): string {
  if (!isAxiosError(error)) return t.errors.generic;
  if (!error.response) return t.errors.network;

  const status = error.response.status;
  if (status === 429) return t.errors.tooMany;

  if (english) {
    const detail = (error.response.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
    // FastAPI validation errors: [{ loc: ["body", "password"], msg: "..." }, ...]
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { loc?: (string | number)[]; msg?: string };
      const field = String(first.loc?.at(-1) ?? "");
      const message = (first.msg ?? "").replace(/^Value error, /, "");
      if (message) return FIELD_NAMES[field] ? `${FIELD_NAMES[field]}: ${message}` : message;
    }
  }
  return overrides[status] ?? byStatus(status, t);
}

/** Turn any API error into one sentence, in the student's language. */
export function useErrorMessage() {
  const { t, locale } = useI18n();
  return useCallback(
    (error: unknown, overrides: Partial<Record<number, string>> = {}) =>
      describe(error, t, locale === "en", overrides),
    [t, locale],
  );
}
