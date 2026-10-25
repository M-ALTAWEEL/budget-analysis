"use client";

import { Check, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { todayISO } from "@/lib/month";
import { updateMe } from "@/services/auth";

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/** Settings: the day the budget month starts (allowance day), and "start fresh". */
export function BudgetCycleSection() {
  const { t, dayLabel } = useI18n();
  const { user, updateUser } = useAuth();
  const errorMessage = useErrorMessage();
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  async function save(changes: Parameters<typeof updateMe>[0]) {
    setError(null);
    setBusy(true);
    try {
      updateUser(await updateMe(changes));
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section aria-labelledby="month-start">
        <h2 id="month-start" className="mb-1 font-display text-lg font-semibold">
          {t.settings.cycleTitle}
        </h2>
        <p className="mb-3 max-w-prose text-sm text-muted">{t.settings.cycleHint}</p>
        <Select
          label={t.settings.cycleLabel}
          value={String(user.month_start_day)}
          onChange={(e) => {
            setSaved(false);
            void save({ month_start_day: Number(e.target.value) }).then(setSaved);
          }}
        >
          {DAYS.map((day) => (
            <option key={day} value={day}>
              {t.settings.cycleDay(day)}
            </option>
          ))}
        </Select>
        {saved && (
          <p role="status" className="mt-2 flex items-center gap-2 text-sm text-pine">
            <Check className="size-4" aria-hidden />
            {t.settings.cycleSaved}
          </p>
        )}
      </section>

      <section aria-labelledby="fresh-start">
        <h2 id="fresh-start" className="mb-3 font-display text-lg font-semibold">
          {t.settings.freshTitle}
        </h2>
        <div className="space-y-3 rounded-2xl border border-line bg-surface px-5 py-4">
          {user.fresh_start_on ? (
            <>
              <p className="text-[15px]">{t.settings.freshOn(dayLabel(user.fresh_start_on))}</p>
              <Button
                variant="secondary"
                loading={busy}
                onClick={() => void save({ fresh_start_on: null })}
              >
                <RotateCcw className="size-4" aria-hidden />
                {t.settings.freshUndo}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">{t.settings.freshText}</p>
              <Button
                variant={confirming ? "danger" : "secondary"}
                loading={busy}
                onClick={() => {
                  if (!confirming) return setConfirming(true);
                  setConfirming(false);
                  void save({ fresh_start_on: todayISO() });
                }}
              >
                <Sparkles className="size-4" aria-hidden />
                {confirming ? t.settings.freshConfirm : t.settings.freshButton}
              </Button>
            </>
          )}
          {error && <p className="text-sm text-berry">{error}</p>}
        </div>
      </section>
    </>
  );
}
