"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, type User } from "@/lib/api";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadUser() {
      const token = window.localStorage.getItem("assetflow_access_token");
      if (!token) {
        if (active) setLoading(false);
        return;
      }
      try {
        const currentUser = await apiFetch<User>("/auth/me");
        if (active) setUser(currentUser);
      } catch {
        window.localStorage.removeItem("assetflow_access_token");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadUser();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const tokens = await apiFetch<{ access_token: string; refresh_token: string }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        window.localStorage.setItem("assetflow_access_token", tokens.access_token);
        window.localStorage.setItem("assetflow_refresh_token", tokens.refresh_token);
        setUser(await apiFetch<User>("/auth/me"));
      },
      signup: async (name, email, password) => {
        await apiFetch<User>("/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) });
        const tokens = await apiFetch<{ access_token: string; refresh_token: string }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        window.localStorage.setItem("assetflow_access_token", tokens.access_token);
        window.localStorage.setItem("assetflow_refresh_token", tokens.refresh_token);
        setUser(await apiFetch<User>("/auth/me"));
      },
      logout: () => {
        window.localStorage.removeItem("assetflow_access_token");
        window.localStorage.removeItem("assetflow_refresh_token");
        setUser(null);
      },
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
