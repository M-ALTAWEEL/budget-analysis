import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { ArrowLeft, Check, Copy, Crown, LogOut, Share2, Shield, UserMinus, Users } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Share, Switch, View } from "react-native";

import { ByUsername } from "@/components/groups/ByUsername";
import { GroupBalances } from "@/components/groups/GroupBalances";
import { GroupExpenses } from "@/components/groups/GroupExpenses";
import { GroupHousehold } from "@/components/groups/GroupHousehold";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Card, List, LoadError, PageLoader, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import {
  createInvite, getGroup, listInvites, removeMember, revokeInvite, setAutoAdd, setMemberRole, updateGroup,
  type GroupDetail, type GroupMember, type Invite,
} from "@/services/groups";
import { useColors } from "@/theme/ThemeProvider";

export const groupKey = (uuid: string) => ["groups", uuid] as const;

function Heading({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint?: string }) {
  return (
    <View style={{ marginBottom: hint ? 4 : 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon}
        <Text display weight="semibold" size={18} accessibilityRole="header">{title}</Text>
      </View>
      {hint && <Text size={14} tone="muted" style={{ marginTop: 4, marginBottom: 8 }}>{hint}</Text>}
    </View>
  );
}

/** One group: balances, the chat, members, invites, settings, leaving. */
export function GroupView({ uuid, onBack }: { uuid: string; onBack: () => void }) {
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const group = useQuery({ queryKey: groupKey(uuid), queryFn: () => getGroup(uuid) });
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["groups", uuid] });
    setRefreshing(false);
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <BackLink onBack={onBack} />
      {group.isPending ? (
        <PageLoader />
      ) : group.isError ? (
        <LoadError message={errorMessage(group.error)} onRetry={() => void group.refetch()} />
      ) : (
        <Body g={group.data} onBack={onBack} t={t} />
      )}
    </Screen>
  );
}

function Body({ g, onBack, t }: { g: GroupDetail; onBack: () => void; t: ReturnType<typeof useI18n>["t"] }) {
  const admin = g.my_role === "owner" || g.my_role === "admin";
  return (
    <>
      <View style={{ marginBottom: 32 }}>
        <Text display weight="semibold" size={24} accessibilityRole="header">{g.name}</Text>
        <Text size={15} tone="muted" style={{ marginTop: 4 }}>{g.currency} · {t.groups.members(g.member_count, g.member_limit)}</Text>
      </View>
      <View style={{ gap: 40 }}>
        <GroupBalances group={g} />
        <GroupHousehold group={g} />
        <GroupExpenses group={g} />
        <Members group={g} />
        {admin && <Invites group={g} />}
        <AutoAdd group={g} />
        {g.my_role === "owner" && <GroupSettings group={g} />}
        <Leave group={g} onLeft={onBack} />
      </View>
    </>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  const { t, dir } = useI18n();
  const colors = useColors();
  return (
    <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8} style={{ marginBottom: 24, flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
      <ArrowLeft size={16} color={colors.pine} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
      <Text size={14} weight="semibold" tone="pine">{t.groups.back}</Text>
    </Pressable>
  );
}

function Members({ group }: { group: GroupDetail }) {
  const { t } = useI18n();
  const colors = useColors();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: groupKey(group.uuid) });
  const role = useMutation({
    mutationFn: ({ member, to }: { member: GroupMember; to: "admin" | "member" }) => setMemberRole(group.uuid, member.uuid, to),
    onSuccess: refresh,
    onError: (err) => setError(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (member: GroupMember) => removeMember(group.uuid, member.uuid),
    onSuccess: refresh,
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <View>
      <Heading icon={<Users size={20} color={colors.muted} />} title={t.groups.members(group.member_count, group.member_limit)} />
      <List>
        {group.members.map((member) => {
          const canManage = !member.is_me && !member.left && (group.my_role === "owner" || (group.my_role === "admin" && member.role === "member"));
          return (
            <View key={member.uuid} style={{ paddingHorizontal: 20, paddingVertical: 14, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <RoleIcon role={member.role} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight={member.left ? "regular" : "semibold"} tone={member.left ? "muted" : "ink"} style={member.left ? { textDecorationLine: "line-through" } : undefined}>
                    {member.display_name}
                    {member.is_me ? <Text size={14} tone="muted">  ({t.groups.you})</Text> : null}
                  </Text>
                  <Text size={14} tone="muted">{member.left ? t.groups.left : t.groups.roles[member.role]}</Text>
                </View>
              </View>
              {canManage && (
                <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
                  {group.my_role === "owner" && member.role !== "owner" && (
                    <Button small variant="ghost" onPress={() => role.mutate({ member, to: member.role === "admin" ? "member" : "admin" })}>
                      {member.role === "admin" ? t.groups.makeMember : t.groups.makeAdmin}
                    </Button>
                  )}
                  <Button small variant="ghost" icon={<UserMinus size={16} color={colors.berry} />} accessibilityLabel={`${t.groups.remove}: ${member.display_name}`} onPress={() => remove.mutate(member)}>
                    <Text size={14} weight="semibold" tone="berry">{t.groups.remove}</Text>
                  </Button>
                </View>
              )}
            </View>
          );
        })}
      </List>
      <FormError message={error} />
    </View>
  );
}

function RoleIcon({ role }: { role: GroupMember["role"] }) {
  const colors = useColors();
  if (role === "owner") return <Crown size={20} color={colors.pine} />;
  if (role === "admin") return <Shield size={20} color={colors.pine} />;
  return <View style={{ width: 20 }} />;
}

function Invites({ group }: { group: GroupDetail }) {
  const { t, shortDate } = useI18n();
  const colors = useColors();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const invitesKey = ["groups", group.uuid, "invites"];
  const invites = useQuery({ queryKey: invitesKey, queryFn: () => listInvites(group.uuid) });
  const [fresh, setFresh] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = group.member_count >= group.member_limit;

  const create = useMutation({
    mutationFn: () => createInvite(group.uuid),
    onSuccess: (invite) => {
      setFresh(invite);
      setCopied(false);
      void queryClient.invalidateQueries({ queryKey: invitesKey });
    },
    onError: (err) => setError(errorMessage(err)),
  });
  const revoke = useMutation({
    mutationFn: (inviteUuid: string) => revokeInvite(group.uuid, inviteUuid),
    onSuccess: (_, inviteUuid) => {
      if (fresh?.uuid === inviteUuid) setFresh(null);
      void queryClient.invalidateQueries({ queryKey: invitesKey });
    },
  });

  return (
    <View>
      <Heading title={t.groups.invite} hint={full ? t.groups.full : t.groups.inviteText} />
      <Card style={{ gap: 16 }}>
        {fresh?.url ? (
          <View style={{ gap: 12 }}>
            {fresh.qr_svg && (
              <View style={{ alignSelf: "center", borderRadius: 12, backgroundColor: "#fff", padding: 8 }}>
                <Image source={{ uri: fresh.qr_svg }} style={{ width: 180, height: 180 }} contentFit="contain" />
              </View>
            )}
            <Text size={12} selectable style={{ writingDirection: "ltr", textAlign: "left", borderRadius: 8, backgroundColor: `${colors.ink}0d`, paddingHorizontal: 12, paddingVertical: 8, overflow: "hidden" }}>
              {fresh.url}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button variant="secondary" icon={copied ? <Check size={16} color={colors.ink} /> : <Copy size={16} color={colors.ink} />}
                onPress={() => void Clipboard.setStringAsync(fresh.url ?? "").then(() => setCopied(true))}>
                {copied ? t.groups.linkCopied : t.groups.copyLink}
              </Button>
              <Button variant="secondary" icon={<Share2 size={16} color={colors.ink} />}
                onPress={() => void Share.share({ title: group.name, message: fresh.url ?? "", url: fresh.url ?? undefined }).catch(() => undefined)}>
                {t.groups.share}
              </Button>
            </View>
          </View>
        ) : (
          <Button variant="secondary" style={{ alignSelf: "flex-start" }} loading={create.isPending} disabled={full} onPress={() => create.mutate()}>
            {t.groups.newLink}
          </Button>
        )}
        {(invites.data?.length ?? 0) > 0 && (
          <View>
            <Text size={14} weight="semibold" style={{ marginBottom: 8 }}>{t.groups.activeLinks(invites.data?.length ?? 0)}</Text>
            <View style={{ gap: 6 }}>
              {invites.data?.map((invite) => (
                <View key={invite.uuid} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <Text size={14} tone="muted">{t.groups.expires(shortDate(invite.expires_at.slice(0, 10)))}</Text>
                  <Pressable onPress={() => revoke.mutate(invite.uuid)} accessibilityRole="button" hitSlop={8}>
                    <Text size={14} weight="semibold" tone="berry">{t.groups.revoke}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}
        <FormError message={error} />
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <ByUsername group={group} />
      </Card>
    </View>
  );
}

function AutoAdd({ group }: { group: GroupDetail }) {
  const { t } = useI18n();
  const colors = useColors();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: (enabled: boolean) => setAutoAdd(group.uuid, enabled),
    onSuccess: (detail) => queryClient.setQueryData(groupKey(group.uuid), detail),
    onError: (err) => setError(errorMessage(err)),
  });
  const on = change.isPending ? Boolean(change.variables) : group.my_auto_add;
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
        <View style={{ flex: 1 }}>
          <Text weight="semibold">{t.groups.autoAdd}</Text>
          <Text size={14} tone="muted" style={{ marginTop: 2 }}>{t.groups.autoAddText}</Text>
        </View>
        <Switch
          value={on}
          accessibilityLabel={t.groups.autoAdd}
          onValueChange={(value) => {
            setError(null);
            change.mutate(value);
          }}
          trackColor={{ true: colors.pine, false: colors.line }}
          thumbColor="#fff"
        />
      </View>
      <FormError message={error} />
    </Card>
  );
}

function GroupSettings({ group }: { group: GroupDetail }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState(group.name);
  const [limit, setLimit] = useState(String(group.member_limit));
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => updateGroup(group.uuid, { name: name.trim(), member_limit: Number(limit) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["groups"] }),
    onError: (err) => setError(errorMessage(err)),
  });
  return (
    <View>
      <Heading title={t.groups.settings} />
      <Card>
        <Field label={t.groups.name} maxLength={60} value={name} onChangeText={setName} />
        <Field label={t.groups.limit} keyboardType="number-pad" maxLength={3} value={limit} onChangeText={(text) => setLimit(text.replace(/\D/g, ""))} />
        <FormError message={error} />
        <Button variant="secondary" style={{ alignSelf: "flex-start" }} loading={save.isPending} disabled={!name.trim() || !limit}
          onPress={() => { setError(null); save.mutate(); }}>
          {t.groups.save}
        </Button>
      </Card>
    </View>
  );
}

function Leave({ group, onLeft }: { group: GroupDetail; onLeft: () => void }) {
  const { t, dir } = useI18n();
  const colors = useColors();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const me = group.members.find((member) => member.is_me);
  const leave = useMutation({
    mutationFn: () => removeMember(group.uuid, me?.uuid ?? ""),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      onLeft();
    },
    onError: (err) => setError(errorMessage(err, { 409: t.groups.settleFirst })),
  });
  if (!me) return null;
  const icon = <LogOut size={16} color={colors.berry} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />;
  return confirming ? (
    <Card style={{ borderColor: `${colors.berry}66` }}>
      <Text>{t.groups.leaveConfirm}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button variant="danger" icon={icon} loading={leave.isPending} onPress={() => leave.mutate()}>{t.groups.leave}</Button>
        <Button variant="ghost" onPress={() => setConfirming(false)}>{t.common.cancel}</Button>
      </View>
      <FormError message={error} />
    </Card>
  ) : (
    <Button variant="danger" style={{ alignSelf: "flex-start" }} icon={icon} onPress={() => setConfirming(true)}>{t.groups.leave}</Button>
  );
}
