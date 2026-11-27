import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, authToken, UNAUTHORIZED_EVENT } from "@/api/client";

export interface AuthUser {
  id: number;
  user_id: string;
  name: string;
  email: string | null;
  role: string;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

interface Auth {
  user: AuthUser | null;
  /** True while a stored token is being checked against /auth/me on page load. */
  loading: boolean;
  login: (userId: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(() => Boolean(authToken.get()));

  const logout = useCallback(() => {
    authToken.set(null);
    setUser(null);
    queryClient.clear(); // never show one user's cached data to the next
  }, [queryClient]);

  // Restore the session from a stored token.
  useEffect(() => {
    if (!authToken.get()) return;
    let alive = true;
    api
      .get<AuthUser>("/auth/me")
      .then((u) => alive && setUser(u))
      .catch(() => alive && logout())
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [logout]);

  // Expired / revoked session on any request → back to the login page.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  const login = useCallback(
    async (userId: string, password: string) => {
      const res = await api.post<LoginResponse>("/auth/login", { user_id: userId, password });
      queryClient.clear();
      authToken.set(res.access_token);
      setUser(res.user);
      return res.user;
    },
    [queryClient],
  );

  const value = useMemo<Auth>(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
