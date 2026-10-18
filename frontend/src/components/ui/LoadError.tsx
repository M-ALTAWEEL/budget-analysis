"use client";

import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/I18nProvider";

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="rounded-2xl border border-berry/30 bg-berry-soft px-5 py-5">
      <p className="text-[15px] text-berry">{message}</p>
      <Button variant="secondary" className="mt-4" onClick={onRetry}>
        {t.common.tryAgain}
      </Button>
    </div>
  );
}
