import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Select } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { createGroup, type GroupDetail } from "@/services/groups";
import { CURRENCIES, type Currency } from "@/types/api";

export function CreateGroupSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (group: GroupDetail) => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<Currency>(user?.base_currency ?? "TRY");
  const [limit, setLimit] = useState("6");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => createGroup({ name: name.trim(), currency, member_limit: Number(limit) }),
    onSuccess: (group) => {
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      onCreated(group);
    },
    onError: (err) => setError(errorMessage(err, { 403: t.groups.verifyFirst })),
  });

  function submit() {
    setError(null);
    if (!name.trim()) return;
    create.mutate();
  }

  return (
    <Sheet title={t.groups.create} onClose={onClose} footer={<Button onPress={submit} loading={create.isPending} disabled={!name.trim()}>{t.groups.create}</Button>}>
      <View style={{ gap: 16 }}>
        <Field label={t.groups.name} placeholder={t.groups.namePlaceholder} maxLength={60} value={name} onChangeText={setName} autoFocus />
        <View>
          <Select
            label={t.groups.currency}
            value={currency}
            options={CURRENCIES.map((code) => ({ value: code, label: `${t.currencies[code]} (${code})` }))}
            onChange={setCurrency}
          />
          <Text size={14} tone="muted" style={{ marginTop: 6 }}>{t.groups.currencyHint}</Text>
        </View>
        <Field
          label={t.groups.limit}
          hint={t.groups.limitHint}
          keyboardType="number-pad"
          maxLength={3}
          value={limit}
          onChangeText={(text) => setLimit(text.replace(/\D/g, ""))}
        />
        <FormError message={error} />
      </View>
    </Sheet>
  );
}
