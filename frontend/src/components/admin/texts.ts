// The admin dashboard is an internal tool, in English only. Its words live here, not in
// i18n/messages (which the mobile app copies).

export const ACTION_LABELS: Record<string, string> = {
  grant_admin: "Made admin",
  revoke_admin: "Admin removed",
  disable_user: "Disabled account",
  enable_user: "Enabled account",
  sign_out_user: "Signed out everywhere",
  resend_verification: "Resent confirmation email",
  currency_added: "Added currency",
  currency_hidden: "Hid currency",
  currency_shown: "Showed currency",
};

/** The name of a currency in a language, from the browser's own list (any ISO code), to
 *  pre-fill the add form. Empty when the browser doesn't know the code. */
export function browserCurrencyName(code: string, locale: "en" | "ar" | "tr"): string {
  if (!/^[A-Z]{3}$/.test(code)) return "";
  try {
    const name = new Intl.DisplayNames([locale], { type: "currency" }).of(code) ?? "";
    // Unknown codes come back as the code itself.
    return name === code ? "" : name.slice(0, 40);
  } catch {
    return "";
  }
}

export const METHOD_LABELS: Record<string, string> = {
  password: "Password",
  google: "Google",
  phone: "Phone",
  apple: "Apple",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: string | null): string {
  return value ? dateFormat.format(new Date(value)) : "—";
}

export function formatDateTime(value: string | null): string {
  return value ? dateTimeFormat.format(new Date(value)) : "—";
}

export function percent(part: number, whole: number): string {
  return whole === 0 ? "0%" : `${Math.round((part / whole) * 100)}%`;
}
