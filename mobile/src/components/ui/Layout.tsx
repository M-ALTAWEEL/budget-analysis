/** Page building blocks: the screen, sections, cards and lists, like the website's. */
import { Children, Fragment, isValidElement, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { VerifyEmailBanner } from "@/components/auth/VerifyEmailBanner";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useColors } from "@/theme/ThemeProvider";

/** A page: safe from the notch, scrolls, pulls to refresh. */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
  padded = true,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  padded?: boolean;
}) {
  const colors = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={["top"]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: padded ? 20 : 0, paddingBottom: 140 }}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pine} />
          ) : undefined
        }>
        <VerifyEmailBanner />
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** A titled block (the website's overview sections). */
export function Section({
  title,
  action,
  children,
  style,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ marginTop: 40 }, style]}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <Text display weight="semibold" size={20} style={{ flexShrink: 1 }}>
          {title}
        </Text>
        {action && (
          <Pressable accessibilityRole="link" onPress={action.onPress} hitSlop={8}>
            <Text size={14} weight="semibold" tone="pine">
              {action.label}
            </Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const colors = useColors();
  return (
    <View
      style={[
        { borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 18, gap: 12 },
        style,
      ]}>
      {children}
    </View>
  );
}

/** A rounded list with a line between rows (the website's divide-y lists). */
export function List({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const colors = useColors();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View
      style={[
        { borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" },
        style,
      ]}>
      {rows.map((row, index) => (
        <Fragment key={isValidElement(row) && row.key !== null ? row.key : index}>
          {index > 0 && <View style={{ height: 1, backgroundColor: colors.line }} />}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

/** A row inside a List: icon, text, and something at the end. */
export function Row({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const colors = useColors();
  const content = (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 13 }, style]}>
      {children}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ backgroundColor: pressed ? `${colors.ink}08` : "transparent" })}>
      {content}
    </Pressable>
  );
}

/** "Nothing here yet": the website's dashed box. */
export function Empty({ title, text, children }: { title?: string; text: string; children?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, padding: 22, gap: 6 }}>
      {title && (
        <Text display weight="semibold" size={19}>
          {title}
        </Text>
      )}
      <Text size={15} tone="muted">
        {text}
      </Text>
      {children && <View style={{ marginTop: 12 }}>{children}</View>}
    </View>
  );
}

export function PageLoader() {
  const colors = useColors();
  return (
    <View style={{ paddingVertical: 60, alignItems: "center" }}>
      <ActivityIndicator color={colors.pine} />
    </View>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const colors = useColors();
  const { t } = useI18n();
  return (
    <View accessibilityRole="alert" style={{ borderRadius: 16, borderWidth: 1, borderColor: `${colors.berry}4d`, backgroundColor: colors.berrySoft, padding: 18, gap: 14 }}>
      <Text size={15} tone="berry">
        {message}
      </Text>
      <Button variant="secondary" onPress={onRetry} style={{ alignSelf: "flex-start" }}>
        {t.common.tryAgain}
      </Button>
    </View>
  );
}

/** A choice chip (categories, languages, split methods). */
export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: ReactNode;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: 12,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.pine : colors.line,
        backgroundColor: selected ? colors.pineSoft : colors.surface,
        paddingHorizontal: selected ? 11 : 12,
        paddingVertical: selected ? 7 : 8,
      }}>
      {icon}
      <Text size={14} weight={selected ? "semibold" : "regular"}>
        {label}
      </Text>
    </Pressable>
  );
}
