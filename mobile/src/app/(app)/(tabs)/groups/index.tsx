import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ChevronRight, Plus, Users } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { CreateGroupSheet } from "@/components/groups/CreateGroupSheet";
import { PendingShares } from "@/components/groups/PendingShares";
import { ReceivedInvitations } from "@/components/groups/ReceivedInvitations";
import { Button } from "@/components/ui/Button";
import { List, LoadError, PageLoader, Row, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { listGroups } from "@/services/groups";
import { useColors } from "@/theme/ThemeProvider";

export default function GroupsScreen() {
  const { t, dir } = useI18n();
  const colors = useColors();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const groups = useQuery({ queryKey: ["groups"], queryFn: listGroups });
  const [creating, setCreating] = useState(false);
  const open = (uuid: string) => router.push({ pathname: "/groups/[uuid]", params: { uuid } });

  return (
    <Screen refreshing={groups.isRefetching} onRefresh={() => void groups.refetch()}>
      <View style={{ marginBottom: 40, gap: 16 }}>
        <View>
          <Text display weight="semibold" size={24} accessibilityRole="header">{t.groups.title}</Text>
          <Text size={15} tone="muted" style={{ marginTop: 4 }}>{t.groups.intro}</Text>
        </View>
        <Button style={{ alignSelf: "flex-start" }} icon={<Plus size={20} color={colors.onPine} />} onPress={() => setCreating(true)}>{t.groups.create}</Button>
      </View>

      <ReceivedInvitations onJoined={open} />
      <PendingShares />

      {groups.isPending ? (
        <PageLoader />
      ) : groups.isError ? (
        <LoadError message={errorMessage(groups.error)} onRetry={() => void groups.refetch()} />
      ) : groups.data.length === 0 ? (
        <Text size={15} tone="muted" style={{ borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, paddingHorizontal: 20, paddingVertical: 32 }}>
          {t.groups.empty}
        </Text>
      ) : (
        <List>
          {groups.data.map((group) => (
            <Row key={group.uuid} onPress={() => open(group.uuid)} style={{ paddingVertical: 16 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.pine}1a` }}>
                <Users size={20} color={colors.pine} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="semibold" numberOfLines={1}>{group.name}</Text>
                <Text size={14} tone="muted">
                  {group.currency} · {t.groups.members(group.member_count, group.member_limit)} · {t.groups.roles[group.my_role]}
                </Text>
              </View>
              <ChevronRight size={20} color={colors.muted} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
            </Row>
          ))}
        </List>
      )}

      {creating && (
        <CreateGroupSheet
          onClose={() => setCreating(false)}
          onCreated={(group) => {
            setCreating(false);
            open(group.uuid);
          }}
        />
      )}
    </Screen>
  );
}
