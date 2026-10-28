"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { createGroup, type GroupDetail } from "@/services/groups";
import type { Currency } from "@/types/api";

export function CreateGroupSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (group: GroupDetail) => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<Currency>(user?.base_currency ?? "TRY");
  const [limit, setLimit] = useState(6);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => createGroup({ name: name.trim(), currency, member_limit: limit }),
    onSuccess: (group) => {
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      onCreated(group);
    },
    onError: (err) => setError(errorMessage(err, { 403: t.groups.verifyFirst })),
  });

  return (
    <Sheet
      title={t.groups.create}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        create.mutate();
      }}
    >
      <div className="space-y-4">
        <Field
          label={t.groups.name}
          placeholder={t.groups.namePlaceholder}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <div>
          <CurrencySelect label={t.groups.currency} value={currency} onChange={setCurrency} />
          <p className="mt-1.5 text-sm text-muted">{t.groups.currencyHint}</p>
        </div>
        <Field
          label={t.groups.limit}
          hint={t.groups.limitHint}
          type="number"
          inputMode="numeric"
          min={2}
          max={100}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          required
        />
        <FormError message={error} />
        <Button type="submit" loading={create.isPending} className="w-full">
          {t.groups.create}
        </Button>
      </div>
    </Sheet>
  );
}
