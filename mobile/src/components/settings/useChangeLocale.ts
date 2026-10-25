"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import type { Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { updateMe } from "@/services/auth";

// A language picked on the login screen is a deliberate choice: it is remembered here
// and saved to the account right after login, instead of being replaced by the
// account's older value. (Memory only: a page reload means "use the account's".)
let pickedWhileSignedOut: Locale | null = null;

export function takeLocalePickedWhileSignedOut(): Locale | null {
  const picked = pickedWhileSignedOut;
  pickedWhileSignedOut = null;
  return picked;
}

/** Switch language now, and save it on the account when someone is logged in. */
export function useChangeLocale() {
  const { setLocale } = useI18n();
  const { user, updateUser } = useAuth();

  return useCallback(
    async (locale: Locale) => {
      setLocale(locale); // instant, even before the server answers
      if (!user) {
        pickedWhileSignedOut = locale;
        return;
      }
      if (user.locale === locale) return;
      try {
        updateUser(await updateMe({ locale }));
      } catch {
        // Saving failed (offline?): the page still switched, the account keeps the old value.
      }
    },
    [setLocale, user, updateUser],
  );
}
