import type { Locale } from "@/i18n/config";

// Shapes returned by the Budget Analysis API. Money is always a string ("120.50"):
// the backend uses exact decimals, and JavaScript numbers are floats.

/** An ISO 4217 code ("TRY"). The list lives on the server, so admins can add currencies:
 *  GET /currency/list (`CurrencyInfo`). */
export type Currency = string;

export type { Locale };

export interface CurrencyInfo {
  code: Currency;
  names: Record<Locale, string>;
  hidden: boolean; // not offered for new choices; still shown for whoever already uses it
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/** The answer to a right password when 2FA is on: a code is needed before any session. */
export interface TwoFactorChallenge {
  two_factor_required: true;
  challenge: string;
}

export interface User {
  uuid: string;
  email: string | null; // null: made with a phone number, no email added yet
  phone: string | null; // +905321234567
  email_verified: boolean;
  has_password: boolean; // false: signs in with Google only
  two_factor_enabled: boolean;
  full_name: string;
  username: string | null; // chosen in Settings, so friends can invite you to a group
  base_currency: Currency;
  secondary_currency: Currency | null;
  locale: Locale;
  month_start_day: number; // 1–28: the day the budget month starts (allowance day)
  fresh_start_on: string | null; // "start fresh": spending before this day is hidden
  notify_groups: boolean; // push notifications about groups (phone app)
  notify_budget: boolean; // push notifications when spending nears or passes a limit
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
  forecast: SpendingForecast | null; // null: past month, or too early in the month
}

/** Where this month is heading. One-offs (rent, aidat) are counted once, not every day. */
export interface SpendingForecast {
  total: string;
  daily_rate: string;
  one_offs: string;
}

export interface RepeatedPurchase {
  label: string; // as the student usually writes it
  category: Category;
  count: number; // times this month
  total: string;
}

/** Things worth knowing from the student's own numbers. Empty when nothing stands out. */
export interface Tips {
  month: string;
  currency: Currency;
  repeated: RepeatedPurchase[];
  busiest_weekday: { weekday: number; average: string; usual: string } | null; // 0 = Monday
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
  // "group": my share of a group expense; "recurring": added by a recurring expense rule
  source: "manual" | "group" | "recurring";
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
  client_id?: string; // feature F13: the same expense sent twice is added once
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

export type AssistantIntent =
  | "spent"
  | "remaining"
  | "top"
  | "forecast"
  | "compare"
  | "goals"
  | "help"
  | "unknown"
  | "no_budget";

export type AssistantPeriod = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month";

/** POST /assistant/ask -> numbers only; the sentence is written in the browser's language. */
export interface AssistantAnswer {
  intent: AssistantIntent;
  confidence: number;
  period: AssistantPeriod | null;
  currency: Currency | null;
  category: Category | null;
  amount: string | null;
  count: number | null;
  total: string | null;
  remaining: string | null;
  daily: string | null;
  days_left: number | null;
  forecast: string | null;
  previous: string | null;
  through_day: number | null;
  categories: { category: Category; spent: string }[];
  goals: Goal[];
}

/** Rent, bills, subscriptions: added by themselves on their day each month (feature F1). */
export interface RecurringExpense {
  uuid: string;
  description: string;
  amount: string;
  currency: Currency;
  category: Category;
  day_of_month: number; // 1–31; the 31st falls on the last day of a shorter month
  starts_on: string;
  ends_on: string | null;
  remind: boolean; // a notification the day before (phone app)
  paused: boolean;
  next_on: string | null; // the next day it will be added; null when paused or ended
}

export interface RecurringList {
  items: RecurringExpense[];
  monthly_total: string; // the active ones, in the person's main currency
  currency: Currency;
}

export interface RecurringInput {
  description: string;
  amount: string;
  currency: Currency;
  category_uuid: string;
  day_of_month: number;
  ends_on?: string | null;
  remind?: boolean;
  paused?: boolean;
  from_expense_uuid?: string; // "repeat every month" on an expense just added
}

/** Money lent to or borrowed from someone outside any group (feature F2). */
export interface DebtPayment {
  uuid: string;
  amount: string;
  paid_on: string;
}

export interface Debt {
  uuid: string;
  person: string;
  direction: "lent" | "borrowed"; // lent: they owe me; borrowed: I owe them
  amount: string;
  currency: Currency;
  note: string | null;
  started_on: string;
  due_on: string | null;
  settled_on: string | null; // set once nothing is left
  paid: string;
  remaining: string;
  overdue: boolean;
  payments: DebtPayment[];
}

export interface DebtList {
  items: Debt[]; // open ones first (by due day), then settled ones
  owed_to_you: string; // open debts in the person's main currency
  you_owe: string;
  currency: Currency;
}

export interface DebtInput {
  person: string;
  direction: "lent" | "borrowed";
  amount: string;
  currency: Currency;
  note?: string | null;
  started_on?: string;
  due_on?: string | null;
}

// ── income (feature F3) ─────────────────────────────────────────────────────

export type IncomeKind = "job" | "scholarship" | "family" | "freelance" | "other";

export interface Income {
  uuid: string;
  source: string;
  kind: IncomeKind;
  amount: string;
  currency: Currency;
  received_on: string;
  note: string | null;
  converted: string | null; // in the month's currency; null: no rate right now
}

export interface IncomeMonth {
  month: string;
  currency: Currency; // the month budget's currency, or the main one without a budget
  items: Income[]; // newest first
  total: string;
  by_kind: { kind: IncomeKind; total: string }[]; // biggest first
  spent: string;
  net: string; // total - spent
  budget: string | null;
}

export interface IncomeInput {
  source: string;
  kind: IncomeKind;
  amount: string;
  currency: Currency;
  received_on: string;
  note?: string | null;
}

// ── month-end report (feature F4) ───────────────────────────────────────────

export interface Wrapped {
  month: string;
  currency: Currency;
  finished: boolean; // false: the month is still going ("so far")
  days: number;
  budget: string;
  spent: string;
  saved: string; // budget - spent; negative when overspent
  expense_count: number;
  no_spend_days: number;
  daily_average: string;
  previous_spent: string | null;
  change_percent: number | null; // spending compared with the month before
  top_categories: { category: Category; spent: string; share: number }[];
  biggest: { description: string; amount: string; spent_at: string; category: Category } | null;
  busiest_weekday: number | null; // 0 = Monday
  income: string | null;
  goals_saved: string;
}

// ── savings challenges (feature F6) ─────────────────────────────────────────

export type ChallengeKind = "no_spend_category" | "spend_under" | "no_spend_days";
export type ChallengeStatus = "upcoming" | "active" | "won" | "lost";

export interface Challenge {
  uuid: string;
  kind: ChallengeKind;
  category: Category | null;
  amount: string | null;
  target_days: number | null;
  starts_on: string;
  ends_on: string;
  currency: Currency;
  status: ChallengeStatus;
  days: number;
  days_done: number;
  value: string; // clean days, money spent or days without spending
  target: string;
  group: string | null;
  group_uuid: string | null;
  participants: { name: string; me: boolean; status: ChallengeStatus; value: string; target: string }[];
}

export interface OpenChallenge {
  uuid: string;
  kind: ChallengeKind;
  category: Category | null;
  amount: string | null;
  target_days: number | null;
  starts_on: string;
  ends_on: string;
  group: string;
  by: string;
}

export interface ChallengeList {
  items: Challenge[];
  open: OpenChallenge[];
  wins: number;
  badges: string[];
  streak: number;
}

export interface ChallengeInput {
  kind: ChallengeKind;
  category_uuid?: string | null;
  amount?: string | null;
  target_days?: number | null;
  starts_on?: string;
  ends_on: string;
  group_uuid?: string | null;
}

// ── household budget of a group (feature F7) ────────────────────────────────

export interface GroupBudget {
  month: string;
  currency: Currency; // the group's
  total_amount: string | null; // null: none set this month
  spent: string;
  remaining: string | null;
  categories: { category: string; limit: string | null; spent: string }[];
  paid_by: { name: string; me: boolean; paid: string }[];
  can_edit: boolean;
}

// ── inflation and currencies (feature F8) ───────────────────────────────────

export interface InflationView {
  stable_currency: Currency;
  months: {
    month: string;
    currency: Currency;
    spent: string;
    spent_stable: string | null; // null: no rate for that month
    rate: string | null;
    partial: boolean;
  }[];
  change_local: number | null;
  change_stable: number | null;
  prices: {
    label: string;
    category: Category;
    currency: Currency;
    first_month: string;
    first_price: string;
    last_month: string;
    last_price: string;
    change: number;
  }[];
}

// ── customer support ────────────────────────────────────────────────────────

export type SupportTopic = "problem" | "idea" | "question" | "account" | "other";

export interface SupportTicket {
  uuid: string;
  topic: SupportTopic;
  subject: string;
  status: "open" | "answered" | "closed";
  created_at: string;
  last_message_at: string;
  unread: boolean; // an answer not opened yet
  messages: { from_support: boolean; author: string; body: string; created_at: string }[];
}

export interface SupportInput {
  topic: SupportTopic;
  subject: string;
  message: string;
  platform?: string;
}

// ── bank statement import (feature F11) ─────────────────────────────────────

export type StatementKind =
  | "purchase" | "bill" | "card_payment" | "transfer_out" | "transfer_in" | "deposit" | "refund" | "other";

export interface StatementRow {
  day: string;
  label: string;
  original: string;
  amount: string;
  direction: "out" | "in";
  kind: StatementKind;
  suggestion: "expense" | "income" | "skip";
  category: Category | null;
  duplicate: boolean; // an expense with the same day and amount is already there
  has_budget: boolean;
}

export interface StatementPreview {
  rows: StatementRow[];
  currency: Currency;
  first_day: string;
  last_day: string;
  money_out: string;
  money_in: string;
}

export interface StatementImportRow {
  day: string;
  description: string;
  amount: string;
  as: "expense" | "income";
  category_uuid?: string | null;
  income_kind?: IncomeKind;
}

export interface StatementImportResult {
  expenses: number;
  income: number;
  already_there: number;
  no_budget: number;
}
