"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { updateMe } from "@/services/auth";

// The same rule as the server (backend/app/domain/user/schema.py): 3 to 20 letters,
// numbers, "." or "_", starting with a letter, no "." or "_" at the end or twice in a row.
const USERNAME = /^[a-z](?:[a-z0-9]|[._](?=[a-z0-9])){2,19}$/;

/** Settings → Profile: the name others see, and the username friends invite you by. */
export function ProfileSection() {
  const { t } = useI18n();
  const { user, updateUser } = useAuth();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState(user?.full_name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const cleaned = username.trim().replace(/^@/, "").toLowerCase();
  const changed = name.trim() !== user.full_name || cleaned !== (user.username ?? "");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    if (cleaned && !USERNAME.test(cleaned)) return setError(t.profile.usernameRule);
    setBusy(true);
    try {
      updateUser(await updateMe({ full_name: name.trim(), username: cleaned || null }));
      setUsername(cleaned);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, { 409: t.profile.usernameTaken, 422: t.profile.usernameRule }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="profile">
      <h2 id="profile" className="mb-3 font-display text-lg font-semibold">
        {t.profile.title}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-line bg-surface px-5 py-4">
        <Field
          label={t.profile.name}
          hint={t.profile.nameHint}
          maxLength={100}
          autoComplete="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          required
        />
        <Field
          label={t.profile.username}
          hint={t.profile.usernameHint}
          dir="ltr"
          placeholder="@sara.k"
          maxLength={21}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setSaved(false);
          }}
        />
        <FormError message={error} />
        {saved && (
          <p role="status" className="flex items-center gap-2 text-sm text-pine">
            <Check className="size-4" aria-hidden />
            {t.profile.saved}
          </p>
        )}
        <Button type="submit" variant="secondary" loading={busy} disabled={!changed || !name.trim()}>
          {t.profile.save}
        </Button>
      </form>
    </section>
  );
}
