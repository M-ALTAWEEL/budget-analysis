import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { acceptRequest, declineRequest, listMyRequests } from "@/services/groups";
import { useColors } from "@/theme/ThemeProvider";

/** Invitations someone sent me by my username: join, or say no thanks. */
export function ReceivedInvitations({ onJoined }: { onJoined: (groupUuid: string) => void }) {
  const { t } = useI18n();
  const colors = useColors();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const requests = useQuery({ queryKey: ["group-requests"], queryFn: listMyRequests });
  const [error, setError] = useState<string | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["group-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["groups"] });
  };
  const accept = useMutation({
    mutationFn: acceptRequest,
    onSuccess: ({ group_uuid }) => {
      refresh();
      onJoined(group_uuid);
    },
    onError: (err) => setError(errorMessage(err, { 403: t.groups.verifyFirst, 409: t.groups.full })),
  });
  const decline = useMutation({ mutationFn: declineRequest, onSuccess: refresh, onError: (err) => setError(errorMessage(err)) });

  if (!requests.data?.length) return null;
  return (
    <View style={{ marginBottom: 40 }}>
      <View style={{ marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Mail size={20} color={colors.pine} />
        <Text display weight="semibold" size={18} accessibilityRole="header">{t.groups.invitations}</Text>
      </View>
      <View style={{ gap: 12 }}>
        {requests.data.map((request) => (
          <View key={request.uuid} style={{ gap: 12, borderRadius: 16, borderWidth: 1, borderColor: `${colors.pine}66`, backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 16 }}>
            <View>
              <Text weight="semibold" numberOfLines={1}>{request.group_name}</Text>
              <Text size={14} tone="muted">
                {request.invited_by ? `${t.groups.invitedYou(request.invited_by)} · ` : ""}
                {t.groups.members(request.member_count, request.member_limit)}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button small loading={accept.isPending && accept.variables === request.uuid} onPress={() => { setError(null); accept.mutate(request.uuid); }}>
                {t.groups.accept}
              </Button>
              <Button small variant="ghost" loading={decline.isPending && decline.variables === request.uuid} onPress={() => { setError(null); decline.mutate(request.uuid); }}>
                {t.groups.decline}
              </Button>
            </View>
          </View>
        ))}
      </View>
      <FormError message={error} />
    </View>
  );
}
