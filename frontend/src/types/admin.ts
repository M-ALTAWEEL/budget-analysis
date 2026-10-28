// What the admin API returns (backend/app/domain/admin/schema.py). Website only: this file
// is not in mobile/scripts/sync-shared.mjs, so the app never ships admin code.

export interface DayCount {
  day: string; // "2026-10-28"
  count: number;
}

export interface AdminStats {
  users_total: number;
  users_disabled: number;
  active_7_days: number;
  active_30_days: number;
  signups_per_day: DayCount[];
  with_password: number;
  with_google: number;
  with_phone: number;
  two_factor_on: number;
  email_verified: number;
  expenses_per_day: DayCount[]; // how many were added, never amounts
  groups_total: number;
  groups_active: number;
  push_devices: number;
}

export interface AdminUserListItem {
  uuid: string;
  email: string | null;
  full_name: string;
  username: string | null;
  created_at: string;
  last_active_at: string | null;
  is_active: boolean;
  is_admin: boolean;
  two_factor_enabled: boolean;
  email_verified: boolean;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminUserDetail {
  uuid: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  username: string | null;
  created_at: string;
  email_verified: boolean;
  has_password: boolean;
  sign_in_methods: string[]; // "password" | "google" | "phone"
  two_factor_enabled: boolean;
  locale: string;
  base_currency: string;
  is_active: boolean;
  is_admin: boolean;
  sessions: { device: string; country: string | null; created_at: string; last_used_at: string }[];
  security_events: { type: string; device: string | null; country: string | null; created_at: string }[];
}

export interface SystemStatus {
  database: "ok" | "unavailable";
  commit: string;
  deploy_env: string;
  app_env: string;
  email_backend: string;
  sms_backend: string;
  push_backend: string;
  google_sign_in: boolean;
  redis: boolean;
  sentry: boolean;
  two_factor_key: boolean;
  rates_fetched_at: string | null;
}

export interface AuditEntry {
  actor: string;
  action: string;
  target: string | null;
  target_uuid: string | null;
  detail: string | null;
  country: string | null;
  created_at: string;
}

export type AdminAction = "disable" | "enable" | "sign-out-all" | "resend-verification";

export interface AdminCurrency {
  code: string;
  name_en: string;
  name_ar: string;
  name_tr: string;
  hidden: boolean;
  added_by: string; // "seed" or the admin's email
  created_at: string;
  users: number; // accounts with it as their main currency
}

export interface CurrencyInput {
  code: string;
  name_en: string;
  name_ar: string;
  name_tr: string;
}
