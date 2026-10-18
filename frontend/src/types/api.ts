import type { Locale } from "@/i18n/config";

// Shapes returned by the BudgetBuddy API. Money is always a string ("120.50"):
// the backend uses exact decimals, and JavaScript numbers are floats.

export const CURRENCIES = ["TRY", "USD", "AED", "SAR", "QAR", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type { Locale };

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface User {
  uuid: string;
  email: string;
  full_name: string;
  base_currency: Currency;
  secondary_currency: Currency | null;
  locale: Locale;
  created_at: string;
}

export interface Category {
  uuid: string;
  slug: string | null;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
}

export interface CategorySpending {
  category: Category;
  limit_amount: string | null;
  spent: string;
}

export interface BudgetSummary {
  month: string; // "2026-10"
  currency: Currency;
  total_amount: string;
  allocated: string;
  spent: string;
  remaining: string;
  categories: CategorySpending[];
}

export interface DaySpending {
  day: string; // "2026-10-05"
  spent: string;
  by_category: Record<string, string>; // { category uuid: amount }
}

/** GET /budgets/{month}/daily: every day of the month, zeros included. */
export interface DailySpending {
  month: string;
  currency: Currency;
  total_amount: string;
  categories: Category[]; // every category used in by_category
  days: DaySpending[];
}

export interface Expense {
  uuid: string;
  amount: string;
  currency: Currency;
  amount_base: string;
  fx_rate: string;
  description: string;
  category: Category;
  spent_at: string; // "2026-10-05"
  categorized_by: string;
  created_at: string;
}

/** All null when the API has no suggestion: the student chooses, as before. */
export interface CategorySuggestion {
  category: Category | null;
  confidence: number | null; // 0..1
  source: "history" | "model" | null;
}

export interface ExpenseInput {
  amount: string;
  currency: Currency;
  description: string;
  category_uuid: string;
  spent_at: string;
}

export interface GoalContribution {
  uuid: string;
  amount: string; // negative = a withdrawal
  note: string | null;
  made_on: string;
  created_at: string;
}

/** A savings goal with progress already worked out by the API. */
export interface Goal {
  uuid: string;
  name: string;
  icon: string;
  color: string;
  currency: Currency;
  target_amount: string;
  target_date: string | null;
  saved: string;
  remaining: string;
  progress: string; // "0.4250" = 42.5%
  achieved: boolean;
  months_left: number | null; // null = no deadline, 0 = deadline passed
  monthly_needed: string | null;
  created_at: string;
}

export interface GoalDetail extends Goal {
  contributions: GoalContribution[];
}

export interface GoalInput {
  name: string;
  target_amount: string;
  currency?: Currency; // only when creating
  target_date: string | null;
  icon: string;
  color: string;
}

export interface ContributionInput {
  kind: "deposit" | "withdrawal";
  amount: string;
  note: string | null;
  made_on: string;
}

/** GET /currency/rates?base=TRY -> how much 1 TRY is in each currency. */
export interface Rates {
  base: Currency;
  rates: Record<Currency, string>;
}
