import { isAxiosError } from "axios";

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
};

/** Turn any API error into one sentence the student can act on. */
export function errorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  if (!isAxiosError(error)) return fallback;
  if (!error.response) return "Can't reach BudgetBuddy's server. Check your connection and try again.";
  if (error.response.status === 429) return "Too many attempts. Wait a minute and try again.";

  const detail = (error.response.data as { detail?: unknown } | undefined)?.detail;
  if (typeof detail === "string") return detail;

  // FastAPI validation errors: [{ loc: ["body", "password"], msg: "..." }, ...]
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { loc?: (string | number)[]; msg?: string };
    const field = String(first.loc?.at(-1) ?? "");
    const message = (first.msg ?? "").replace(/^Value error, /, "");
    return FIELD_NAMES[field] ? `${FIELD_NAMES[field]}: ${message}` : message || fallback;
  }
  return fallback;
}
