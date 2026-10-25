import { useLocalSearchParams, useRouter } from "expo-router";

import { GroupView } from "@/components/groups/GroupView";

export default function GroupScreen() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const router = useRouter();
  return <GroupView uuid={uuid} onBack={() => (router.canGoBack() ? router.back() : router.replace("/groups"))} />;
}
