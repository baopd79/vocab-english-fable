"use client";

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

  const loginWithGoogle = useCallback(async (credential: string) => {
    const { access } = await api<{ access: string }>("/api/v1/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    });
    setAccessToken(access);
    const me = await api<AuthUser>("/api/v1/me");
    setUser(me);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await api<void>("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // The server-side session is unrecoverable anyway — always log out locally.
    }
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

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
