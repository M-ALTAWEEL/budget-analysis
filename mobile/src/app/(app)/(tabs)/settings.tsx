import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { type Href, useRouter } from "expo-router";
import { ChevronRight, LifeBuoy, LogOut, Monitor, Moon, Shapes, Sun, type LucideIcon } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { useAuth } from "@/components/auth/AuthProvider";
import { AccountActions } from "@/components/settings/AccountActions";
import { AppLockSection } from "@/components/settings/AppLockSection";
import { NotificationsSection } from "@/components/settings/NotificationsSection";
import { BudgetCycleSection } from "@/components/settings/BudgetCycleSection";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { SettingsBlock } from "@/components/settings/SettingsBlock";
import { useChangeLocale } from "@/components/settings/useChangeLocale";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { Button } from "@/components/ui/Button";
import { Card, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { LOCALES, LOCALE_INFO, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { forgetPushDevice } from "@/lib/push";
import { updateMe } from "@/services/auth";
import { getVersion } from "@/services/system";
import { useSupport } from "@/hooks/queries";
import { ACCENTS, SWATCHES, useColors, useTheme, type ThemePreference } from "@/theme/ThemeProvider";
import type { Currency } from "@/types/api";

const FLAG: Record<Locale, string> = { en: "🇬🇧", ar: "🇸🇦", tr: "🇹🇷" };
const THEMES: { value: ThemePreference; icon: LucideIcon }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

/** Large, tappable options where exactly one is chosen (the website's Choice). */
function Choice({ selected, onSelect, children, half }: { selected: boolean; onSelect: () => void; children: ReactNode; half?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onSelect}
      style={{
        width: half ? "48.5%" : "100%", flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12,
        borderWidth: selected ? 2 : 1, borderColor: selected ? colors.pine : colors.line,
        backgroundColor: selected ? colors.pineSoft : colors.surface,
        paddingHorizontal: selected ? 15 : 16, paddingVertical: selected ? 11 : 12,
      }}>
      {children}
    </Pressable>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View>
      <Text display weight="semibold" size={18} accessibilityRole="header" style={{ marginBottom: 12 }}>{title}</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const { t, locale } = useI18n();
  const changeLocale = useChangeLocale();
  const { preference, setPreference, accent, setAccent, colors } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <Screen>
      <Text display weight="semibold" size={24} accessibilityRole="header" style={{ marginBottom: 40 }}>{t.settings.title}</Text>
      <View style={{ gap: 40 }}>
        <ProfileSection />

        <Block title={t.settings.language}>
          {LOCALES.map((code) => (
            <Choice key={code} selected={code === locale} onSelect={() => void changeLocale(code)}>
              <Text size={18}>{FLAG[code]}</Text>
              <Text size={15} weight={code === locale ? "semibold" : "regular"}>{LOCALE_INFO[code].label}</Text>
            </Choice>
          ))}
        </Block>

        <Block title={t.settings.appearance}>
          {THEMES.map(({ value, icon: Icon }) => (
            <Choice key={value} selected={value === preference} onSelect={() => setPreference(value)}>
              <Icon size={20} color={colors.muted} />
              <Text size={15} weight={value === preference ? "semibold" : "regular"}>{t.settings[value]}</Text>
            </Choice>
          ))}
        </Block>

        <Block title={t.settings.accent}>
          {ACCENTS.map((value) => (
            <Choice key={value} half selected={value === accent} onSelect={() => setAccent(value)}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: SWATCHES[value] }} />
              <Text size={15} weight={value === accent ? "semibold" : "regular"}>{t.settings.accents[value]}</Text>
            </Choice>
          ))}
        </Block>

        <MainCurrency />
        <SecondCurrency />
        <BudgetCycleSection />

        <Pressable
          onPress={() => router.push("/categories")}
          accessibilityRole="link"
          style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 16 }}>
          <Shapes size={20} color={colors.muted} />
          <Text size={15} weight="semibold" style={{ flex: 1 }}>{t.settings.manageCategories}</Text>
          <ChevronRight size={20} color={colors.muted} style={locale === "ar" ? { transform: [{ scaleX: -1 }] } : undefined} />
        </Pressable>

        <SupportLink />

        <View>
          <Text display weight="semibold" size={18} accessibilityRole="header" style={{ marginBottom: 12 }}>{t.settings.account}</Text>
          <Card>
            <Text weight="semibold">{user?.full_name}</Text>
            <Text size={14} tone="muted" style={{ writingDirection: "ltr" }}>
              {user?.username ? `@${user.username} · ` : ""}
              {user?.email ?? user?.phone}
            </Text>
            <Button
              variant="secondary"
              style={{ marginTop: 16, alignSelf: "flex-start" }}
              icon={<LogOut size={16} color={colors.ink} style={locale === "ar" ? { transform: [{ scaleX: -1 }] } : undefined} />}
              onPress={() => void forgetPushDevice().finally(() => void logout())}>
              {t.nav.logout}
            </Button>
          </Card>
        </View>

        <NotificationsSection />
        <AppLockSection />
        <SecuritySection />
        <AccountActions />
        <Versions />
      </View>
    </Screen>
  );
}

/** Which code runs in the app and on the server. */
function Versions() {
  const { t } = useI18n();
  const { data } = useQuery({ queryKey: ["version"], queryFn: getVersion, staleTime: 5 * 60_000 });
  return (
    <Text size={12} tone="muted" style={{ writingDirection: "ltr", textAlign: "left" }}>
      {t.settings.version}: app {Constants.expoConfig?.version ?? "?"} · api {data?.commit ?? "…"}
      {data && data.environment !== "production" ? ` (${data.environment})` : ""}
    </Text>
  );
}

/** The currency of new budgets and expenses. Months already set up keep theirs. */
function MainCurrency() {
  const { t } = useI18n();
  const { user, updateUser } = useAuth();
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  async function change(value: Currency) {
    setError(null);
    try {
      // If the second currency was this one, clear it: showing TRY ≈ TRY says nothing.
      const clearSecond = user?.secondary_currency === value;
      updateUser(await updateMe({ base_currency: value, ...(clearSecond ? { secondary_currency: null } : {}) }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <SettingsBlock title={t.settings.mainCurrency}>
      <CurrencySelect
        label={t.settings.mainCurrencyHint}
        value={user.base_currency}
        onChange={(value) => void change(value)}
      />
      {error && <Text size={14} tone="berry" style={{ marginTop: 8 }}>{error}</Text>}
    </SettingsBlock>
  );
}

/** Show amounts also in a second currency (≈), saved on the account. */
function SecondCurrency() {
  const { t } = useI18n();
  const { user, updateUser } = useAuth();
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  async function change(value: string) {
    setError(null);
    try {
      updateUser(await updateMe({ secondary_currency: value === "" ? null : (value as Currency) }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <SettingsBlock title={t.settings.secondCurrency}>
      <CurrencySelect
        label={t.settings.secondCurrencyHint}
        value={user.secondary_currency ?? ""}
        exclude={user.base_currency}
        none={t.settings.none}
        onChange={(value) => void change(value)}
      />
      {error && <Text size={14} tone="berry" style={{ marginTop: 8 }}>{error}</Text>}
    </SettingsBlock>
  );
}

/** Help and feedback, with the number of answers not read yet. */
function SupportLink() {
  const router = useRouter();
  const colors = useColors();
  const { t, dir } = useI18n();
  const tickets = useSupport();
  const unread = tickets.data?.filter((ticket) => ticket.unread).length ?? 0;
  return (
    <Pressable
      onPress={() => router.push("/support" as Href)}
      accessibilityRole="link"
      style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 16 }}>
      <LifeBuoy size={20} color={colors.muted} />
      <View style={{ flex: 1 }}>
        <Text size={15} weight="semibold">{t.support.link}</Text>
        <Text size={13} tone="muted">{t.support.linkHint}</Text>
      </View>
      {unread > 0 && (
        <View style={{ minWidth: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.pine }}>
          <Text size={12} weight="semibold" tone="onPine">{unread}</Text>
        </View>
      )}
      <ChevronRight size={20} color={colors.muted} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
    </Pressable>
  );
}
