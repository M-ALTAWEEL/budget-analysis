import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Wallet } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { List } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { addAllShares, addShare, dismissShare, listPendingShares } from "@/services/groups";
import { useColors } from "@/theme/ThemeProvider";

export const PENDING_SHARES_KEY = ["group-shares"] as const;

export function usePendingShares() {
  return useQuery({ queryKey: PENDING_SHARES_KEY, queryFn: listPendingShares });
}

/** Groups screen: my shares that aren't in my budget yet. Add them, or skip them. */
export function PendingShares() {
  const { t, money, shortDate } = useI18n();
  const colors = useColors();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const shares = usePendingShares();
  const [error, setError] = useState<string | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: PENDING_SHARES_KEY });
    void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "groups" });
  };
  const needBudget = { 409: t.errors.needBudget };

  const addAll = useMutation({
    mutationFn: addAllShares,
    onSuccess: ({ added, waiting }) => {
      refresh();
      toast.success([t.groups.addedSome(added), waiting ? t.groups.stillWaiting(waiting) : ""].join(" "));
    },
    onError: (err) => setError(errorMessage(err)),
  });
  const addOne = useMutation({ mutationFn: addShare, onSuccess: refresh, onError: (err) => setError(errorMessage(err, needBudget)) });
  const skip = useMutation({ mutationFn: dismissShare, onSuccess: refresh, onError: (err) => setError(errorMessage(err)) });

  if (!shares.data?.length) return null;
  return (
    <View style={{ marginBottom: 40 }}>
      <View style={{ marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
          <Wallet size={20} color={colors.pine} />
          <Text display weight="semibold" size={18} accessibilityRole="header">{t.groups.pending}</Text>
        </View>
        {shares.data.length > 1 && (
          <Button small loading={addAll.isPending} onPress={() => addAll.mutate()}>{t.groups.addAll}</Button>
        )}
      </View>
      <Text size={14} tone="muted" style={{ marginBottom: 12 }}>{t.groups.pendingText}</Text>
      <List>
        {shares.data.map((share) => (
          <View key={share.uuid} style={{ paddingHorizontal: 20, paddingVertical: 14, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="semibold" numberOfLines={1}>{share.description}</Text>
                <Text size={14} tone="muted" numberOfLines={1}>{share.group_name} · {shortDate(share.spent_at)}</Text>
              </View>
              <Text weight="semibold">{money(share.amount, share.currency)}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 4 }}>
              <Button
                small
                variant="secondary"
                loading={addOne.isPending && addOne.variables === share.uuid}
                onPress={() => {
                  setError(null);
                  addOne.mutate(share.uuid);
                }}>
                {t.groups.addToBudget}
              </Button>
              <Button
                small
                variant="ghost"
                loading={skip.isPending && skip.variables === share.uuid}
                onPress={() => {
                  setError(null);
                  skip.mutate(share.uuid);
                }}>
                {t.groups.dismiss}
              </Button>
            </View>
          </View>
        ))}
      </List>
      <FormError message={error} />
    </View>
  );
}

/** Overview: one line when shares are waiting, linking to the Groups screen. */
export function PendingSharesBanner() {
  const { t } = useI18n();
  const colors = useColors();
  const router = useRouter();
  const shares = usePendingShares();
  const count = shares.data?.length ?? 0;
  if (!count) return null;
  return (
    <Pressable
      onPress={() => router.navigate("/groups")}
      accessibilityRole="link"
      style={{ marginBottom: 32, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: `${colors.pine}66`, backgroundColor: colors.pineSoft, paddingHorizontal: 20, paddingVertical: 14 }}>
      <Wallet size={20} color={colors.pine} />
      <Text size={15} weight="semibold" style={{ flex: 1 }}>{t.groups.pendingCount(count)}</Text>
    </Pressable>
  );
}
