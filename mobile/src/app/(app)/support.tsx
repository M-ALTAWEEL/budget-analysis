import { useRouter } from "expo-router";
import { ChevronDown, ChevronLeft, LifeBuoy } from "lucide-react-native";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { SupportForm } from "@/components/support/SupportForm";
import { Button } from "@/components/ui/Button";
import { LoadError, PageLoader, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useOpenSupport, useReplyToSupport, useSupport, useWriteToSupport } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { useColors } from "@/theme/ThemeProvider";
import type { SupportTicket } from "@/types/api";

/** Help and feedback, like the website's page. A support answer's notification opens it. */
export default function SupportScreen() {
  const tickets = useSupport();
  const write = useWriteToSupport();
  const router = useRouter();
  const colors = useColors();
  const { t, dir } = useI18n();
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen refreshing={tickets.isRefetching} onRefresh={() => void tickets.refetch()}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/settings"))} accessibilityRole="button" accessibilityLabel={t.nav.settings} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 12, marginStart: -6 }}>
        <ChevronLeft size={24} color={colors.muted} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
        <Text size={14} weight="semibold" tone="muted">{t.nav.settings}</Text>
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <LifeBuoy size={24} color={colors.pine} />
        <Text display weight="semibold" size={24} accessibilityRole="header">{t.support.title}</Text>
      </View>
      <Text size={15} tone="muted" style={{ marginTop: 4, marginBottom: 24 }}>{t.support.intro}</Text>

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 16, marginBottom: 32, gap: 12 }}>
        <Text display weight="semibold" size={18}>{t.support.newTitle}</Text>
        <SupportForm
          sending={write.isPending}
          error={error}
          onSend={async (input) => {
            setError(null);
            try {
              await write.mutateAsync(input);
              toast.success(t.support.sent);
              return true;
            } catch (err) {
              setError(errorMessage(err));
              return false;
            }
          }}
        />
      </View>

      {tickets.isPending ? (
        <PageLoader />
      ) : tickets.isError ? (
        <LoadError message={errorMessage(tickets.error)} onRetry={() => void tickets.refetch()} />
      ) : tickets.data.length === 0 ? (
        <Text tone="muted">{t.support.empty}</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {tickets.data.map((ticket) => (
            <Conversation key={ticket.uuid} ticket={ticket} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function Conversation({ ticket }: { ticket: SupportTicket }) {
  const { t, shortDate, dir } = useI18n();
  const colors = useColors();
  const errorMessage = useErrorMessage();
  const open = useOpenSupport();
  const reply = useReplyToSupport();
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const tone = ticket.status === "answered" ? "pine" : ticket.status === "closed" ? "muted" : "marigold";

  function toggle() {
    if (!expanded && ticket.unread) open.mutate(ticket.uuid);
    setExpanded(!expanded);
  }

  async function send() {
    if (!text.trim()) return;
    try {
      await reply.mutateAsync({ uuid: ticket.uuid, message: text.trim() });
      setText("");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
      <Pressable onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded }} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>{ticket.subject}</Text>
            {ticket.unread && (
              <View style={{ borderRadius: 999, backgroundColor: colors.pine, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text size={12} weight="semibold" tone="onPine">{t.support.newAnswer}</Text>
              </View>
            )}
          </View>
          <Text size={14} tone="muted">
            {t.support.topics[ticket.topic]} · {shortDate(ticket.last_message_at.slice(0, 10))} · <Text size={14} weight="semibold" tone={tone}>{t.support.status[ticket.status]}</Text>
          </Text>
        </View>
        <ChevronDown size={20} color={colors.muted} style={expanded ? { transform: [{ rotate: "180deg" }] } : undefined} />
      </Pressable>
      {expanded && (
        <View style={{ borderTopWidth: 1, borderColor: colors.line, padding: 16, gap: 10 }}>
          {ticket.messages.map((m, i) => (
            <View
              key={i}
              style={{
                maxWidth: "85%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
                alignSelf: m.from_support ? "flex-start" : "flex-end",
                backgroundColor: m.from_support ? colors.pineSoft : `${colors.ink}0d`,
              }}>
              <Text size={12} weight="semibold" tone="muted">{m.from_support ? t.support.team : t.support.you}</Text>
              <Text size={15}>{m.body}</Text>
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t.support.replyPlaceholder}
              placeholderTextColor={colors.muted}
              maxLength={4000}
              style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 8, color: colors.ink, textAlign: dir === "rtl" ? "right" : "left" }}
            />
            <Button small variant="secondary" onPress={() => void send()} loading={reply.isPending}>{t.support.reply}</Button>
          </View>
        </View>
      )}
    </View>
  );
}
