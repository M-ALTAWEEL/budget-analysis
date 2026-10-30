"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { onSessionExpired, refreshAccessToken } from "@/lib/api";
import { forgetPending } from "@/lib/offline";
import * as authService from "@/services/auth";
import type { User } from "@/types/api";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: Status;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: authService.RegisterInput) => Promise<void>;
  loginWithGoogle: (
    credential: string,
    newAccount: Pick<authService.RegisterInput, "base_currency" | "locale">,
  ) => Promise<void>;
  loginWithPhone: (
    phone: string,
    code: string,
    newAccount: Pick<authService.RegisterInput, "base_currency" | "locale">,
  ) => Promise<void>;
  logout: () => Promise<void>;
  /** Set when the password (or Google) was right but a 2FA code is needed next. */
  twoFactorChallenge: string | null;
  completeTwoFactor: (code: string) => Promise<void>;
  cancelTwoFactor: () => void;
  /** After a profile change (PATCH /users/me), so every screen sees the new values. */
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Restoring the session runs once per page load, even though React's StrictMode runs
// effects twice in development (two refresh calls would trigger reuse detection).
let restoring: Promise<User | null> | null = null;

async function restoreSession(): Promise<User | null> {
  const token = await refreshAccessToken(); // uses the httpOnly cookie
  if (!token) return null;
  try {
    return await authService.getMe();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<{ status: Status; user: User | null }>({
    status: "loading",
    user: null,
  });

  useEffect(() => {
    let active = true;
    restoring ??= restoreSession();
    restoring.then((user) => {
      if (active) setState({ status: user ? "authenticated" : "anonymous", user });
    });
    const stopListening = onSessionExpired(() => {
      restoring = null;
      queryClient.clear();
      setState({ status: "anonymous", user: null });
    });
    return () => {
      active = false;
      stopListening();
    };
  }, [queryClient]);

  const signedIn = useCallback(async () => {
    const user = await authService.getMe();
    restoring = Promise.resolve(user);
    setState({ status: "authenticated", user });
  }, []);

  const [twoFactorChallenge, setTwoFactorChallenge] = useState<string | null>(null);

  const login = useCallback(
    async (email: string, password: string) => {
      const challenge = await authService.login(email, password);
      if (challenge) return setTwoFactorChallenge(challenge);
      await signedIn();
    },
    [signedIn],
  );

  const completeTwoFactor = useCallback(
    async (code: string) => {
      if (!twoFactorChallenge) return;
      await authService.verifyTwoFactor(twoFactorChallenge, code);
      setTwoFactorChallenge(null);
      await signedIn();
    },
    [twoFactorChallenge, signedIn],
  );

  const cancelTwoFactor = useCallback(() => setTwoFactorChallenge(null), []);

  const loginWithPhone = useCallback(
    async (
      phone: string,
      code: string,
      newAccount: Pick<authService.RegisterInput, "base_currency" | "locale">,
    ) => {
      const challenge = await authService.verifyPhoneCode(phone, code, newAccount);
      if (challenge) return setTwoFactorChallenge(challenge);
      await signedIn();
    },
    [signedIn],
  );

  const register = useCallback(
    async (input: authService.RegisterInput) => {
      await authService.register(input);
      await signedIn();
    },
    [signedIn],
  );

  const loginWithGoogle = useCallback(
    async (
      credential: string,
      newAccount: Pick<authService.RegisterInput, "base_currency" | "locale">,
    ) => {
      const challenge = await authService.googleSignIn(credential, newAccount);
      if (challenge) return setTwoFactorChallenge(challenge);
      await signedIn();
    },
    [signedIn],
  );

  const logout = useCallback(async () => {
    await authService.logout();
    restoring = null;
    queryClient.clear(); // never show one student's data to the next
    forgetPending(); // nor leave their offline expenses on the device
    setState({ status: "anonymous", user: null });
  }, [queryClient]);

  const updateUser = useCallback((user: User) => {
    restoring = Promise.resolve(user);
    setState({ status: "authenticated", user });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      login,
      register,
      loginWithGoogle,
      loginWithPhone,
      logout,
      updateUser,
      twoFactorChallenge,
      completeTwoFactor,
      cancelTwoFactor,
    }),
    [
      state,
      login,
      register,
      loginWithGoogle,
      loginWithPhone,
      logout,
      updateUser,
      twoFactorChallenge,
      completeTwoFactor,
      cancelTwoFactor,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

/** For screens that only render when signed in. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("useCurrentUser used outside the signed-in area");
  return user;
}
