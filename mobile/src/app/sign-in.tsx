import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LoginForm, RegisterForm } from "@/components/auth/AuthForm";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { useAuth } from "@/components/auth/AuthProvider";
import { TwoFactorStep } from "@/components/auth/TwoFactorStep";
import { LanguageMenu, ThemeButton } from "@/components/settings/LanguageMenu";
import { Logo } from "@/components/ui/Logo";
import { useColors } from "@/theme/ThemeProvider";

/** The website's AuthFrame on a phone: logo, language and theme, then the form. */
export default function SignInScreen() {
  const colors = useColors();
  const { twoFactorChallenge } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Logo />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <LanguageMenu />
              <ThemeButton />
            </View>
          </View>
          <View style={{ marginVertical: "auto", paddingVertical: 48 }}>
            {twoFactorChallenge ? (
              <TwoFactorStep />
            ) : mode === "forgot" ? (
              <ForgotPasswordForm onBack={() => setMode("login")} />
            ) : mode === "login" ? (
              <LoginForm onSwitch={() => setMode("register")} onForgot={() => setMode("forgot")} />
            ) : (
              <RegisterForm onSwitch={() => setMode("login")} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
