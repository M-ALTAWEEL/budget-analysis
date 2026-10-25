import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Users } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { PageLoader, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { acceptInvite, previewInvite } from "@/services/groups";
import { useColors } from "@/theme/ThemeProvider";

/** budgetanalysis://groups/join?token=…: who invited you to what, then one button. */
export default function JoinScreen() {
  const { token = "" } = useLocalSearchParams<{ token?: string }>();
  return <Screen>{token ? <Preview token={token} /> : <Invalid />}</Screen>;
}

function Preview({ token }: { token: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const preview = useQuery({ queryKey: ["invite", token], queryFn: () => previewInvite(token), retry: false });
  const join = useMutation({
    mutationFn: () => acceptInvite(token),
    onSuccess: (group) => {
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      router.replace({ pathname: "/groups/[uuid]", params: { uuid: group.uuid } });
    },
  });

  if (preview.isPending) return <PageLoader />;
  if (preview.isError) {
    return isAxiosError(preview.error) && preview.error.response?.status === 404 ? (
      <Invalid />
    ) : (
      <Card><FormError message={errorMessage(preview.error)} /></Card>
    );
  }
  const p = preview.data;
  const full = p.member_count >= p.member_limit && !p.already_member;
  return (
    <Card>
      <Text>{t.groups.joinText(p.group_name, p.member_count, p.member_limit)}</Text>
      {p.already_member && <Text size={14} tone="muted">{t.groups.alreadyIn}</Text>}
      {full && <Text size={14} tone="berry">{t.groups.full}</Text>}
      <FormError message={join.isError ? errorMessage(join.error, { 403: t.groups.verifyFirst, 404: t.groups.inviteInvalid }) : null} />
      <Button loading={join.isPending} disabled={full} onPress={() => join.mutate()}>{p.already_member ? t.groups.open : t.groups.join}</Button>
    </Card>
  );
}

function Invalid() {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <Card>
      <Text tone="berry">{t.groups.inviteInvalid}</Text>
      <Pressable onPress={() => router.replace("/groups")} accessibilityRole="link" style={{ alignSelf: "flex-start" }}>
        <Text size={14} weight="semibold" tone="pine">{t.groups.back}</Text>
      </Pressable>
    </Card>
  );
}

function Card({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const colors = useColors();
  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Users size={24} color={colors.pine} />
        <Text display weight="semibold" size={24} accessibilityRole="header">{t.groups.joinTitle}</Text>
      </View>
      {children}
    </View>
  );
}
