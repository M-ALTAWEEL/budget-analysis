import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { AtSign } from "lucide-react-native";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { cancelRequest, inviteByUsername, listSentRequests, type GroupDetail } from "@/services/groups";
import { useColors } from "@/theme/ThemeProvider";

/** Admins: invite someone by their username, and see who hasn't answered yet. */
export function ByUsername({ group }: { group: GroupDetail }) {
  const { t } = useI18n();
  const colors = useColors();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const key = ["groups", group.uuid, "requests"];
  const pending = useQuery({ queryKey: key, queryFn: () => listSentRequests(group.uuid) });
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const full = group.member_count >= group.member_limit;

  const send = useMutation({
    mutationFn: () => inviteByUsername(group.uuid, username.trim()),
    onSuccess: (request) => {
      setSentTo(request.display_name);
      setUsername("");
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (err) => {
      const detail = isAxiosError(err) ? String(err.response?.data?.detail ?? "") : "";
      setError(
        errorMessage(err, {
          404: t.groups.noSuchUser,
          403: t.errors.forbidden,
          409: detail.includes("full") ? t.groups.full : detail.includes("said no") ? t.groups.declinedRecently : t.groups.alreadyMember,
        }),
      );
    },
  });
  const cancel = useMutation({
    mutationFn: (requestUuid: string) => cancelRequest(group.uuid, requestUuid),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
  });

  function submit() {
    setError(null);
    setSentTo(null);
    if (username.trim()) send.mutate();
  }

  return (
    <View style={{ gap: 12 }}>
      <Text size={14} weight="semibold">{t.groups.byUsername}</Text>
      <Text size={14} tone="muted">{t.groups.byUsernameText}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1, height: 44, flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 12, gap: 6, direction: "ltr", opacity: full ? 0.5 : 1 }}>
          <AtSign size={16} color={colors.muted} />
          <TextInput
            accessibilityLabel={t.groups.byUsername}
            value={username}
            onChangeText={setUsername}
            placeholder={t.groups.usernamePlaceholder.replace("@", "")}
            placeholderTextColor={`${colors.muted}b3`}
            maxLength={21}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            editable={!full}
            onSubmitEditing={submit}
            style={{ flex: 1, height: 44, fontSize: 15, color: colors.ink, textAlign: "left" }}
          />
        </View>
        <Button variant="secondary" loading={send.isPending} disabled={full || !username.trim()} onPress={submit}>{t.groups.send}</Button>
      </View>
      <FormError message={error} />
      {sentTo && <Text size={14} tone="pine">{t.groups.sentTo(sentTo)}</Text>}
      {(pending.data?.length ?? 0) > 0 && (
        <View style={{ gap: 6 }}>
          {pending.data?.map((request) => (
            <View key={request.uuid} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Text size={14} numberOfLines={1} style={{ flex: 1 }}>
                <Text size={14} weight="semibold">{request.display_name}</Text>
                {request.username ? <Text size={14} tone="muted"> @{request.username}</Text> : null}
                <Text size={14} tone="muted"> · {t.groups.waiting}</Text>
              </Text>
              <Pressable onPress={() => cancel.mutate(request.uuid)} accessibilityRole="button" hitSlop={8}>
                <Text size={14} weight="semibold" tone="berry">{t.groups.cancel}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
