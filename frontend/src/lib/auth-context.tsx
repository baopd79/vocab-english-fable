"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, refreshSession, setAccessToken } from "@/lib/api";

export type AuthUser = {
  id: number;
  email: string;
  display_name: string;
  avatar_url: string;
};

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  // The QueryClient (providers.tsx) outlives the session, so cached data would
  // leak across accounts (SPEC §17.1-A1) — clear it on every session boundary.
  const queryClient = useQueryClient();

  // Session restore on mount: the refresh cookie is the only persistent state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const restored = await refreshSession();
      if (cancelled) return;
      if (!restored) {
        setStatus("unauthenticated");
        return;
      }
      try {
        const me = await api<AuthUser>("/api/v1/me");
        if (cancelled) return;
        setUser(me);
        setStatus("authenticated");
      } catch {
        if (!cancelled) setStatus("unauthenticated");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      const { access } = await api<{ access: string }>("/api/v1/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential }),
      });
      // Also needed here: a session that died via 401 lands on /login without
      // ever calling logout(), leaving the previous account's cache behind.
      queryClient.clear();
      setAccessToken(access);
      const me = await api<AuthUser>("/api/v1/me");
      setUser(me);
      setStatus("authenticated");
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api<void>("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // The server-side session is unrecoverable anyway — always log out locally.
    }
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
    // Batched with the state updates above: RequireAuth unmounts consumers in
    // the same render pass, so the cleared queries are not refetched.
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({ status, user, loginWithGoogle, logout }),
    [status, user, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
