"use client";

import * as React from "react";

import { api } from "@/lib/api";
import type { Me } from "@/lib/types";

interface AuthState {
  user: Me | null;
  loading: boolean;
  /** Vuelve a pedir /auth/me (tras login, edición de perfil, etc.). */
  reload: () => Promise<Me | null>;
  setUser: (user: Me | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<Me | null>(null);
  const [loading, setLoading] = React.useState(true);

  const reload = React.useCallback(async () => {
    try {
      const me = await api<Me>("/auth/me");
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const logout = React.useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST", noRefresh: true });
    } finally {
      setUser(null);
    }
  }, []);

  const value = React.useMemo(
    () => ({ user, loading, reload, setUser, logout }),
    [user, loading, reload, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
