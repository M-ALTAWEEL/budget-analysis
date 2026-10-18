"use client";

import { LoaderCircle } from "lucide-react";

import { useI18n } from "@/i18n/I18nProvider";

export function PageLoader() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-muted" role="status">
      <LoaderCircle className="size-6 animate-spin" aria-hidden />
      <span className="sr-only">{t.common.loading}</span>
    </div>
  );
}
