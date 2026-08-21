import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser } from "../types";
import * as authApi from "../lib/authApi";
import { setAccessToken } from "../lib/tokenStore";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    name: string;
    role: "STUDENT" | "TEACHER";
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  // Au premier chargement de l'app, on tente de restaurer la session via
  // le cookie httpOnly de refresh token — l'utilisateur reste connecté
  // même après avoir fermé l'onglet ou rechargé la page.
  useEffect(() => {
    let cancelled = false;
    authApi
      .refreshSession()
      .then((res) => {
        if (cancelled) return;
        setAccessToken(res.accessToken);
        setUser(res.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        setAccessToken(null);
        setStatus("unauthenticated");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    setAccessToken(res.accessToken);
    setUser(res.user);
    setStatus("authenticated");
  }, []);

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      name: string;
      role: "STUDENT" | "TEACHER";
    }) => {
      const res = await authApi.register(input);
      setAccessToken(res.accessToken);
      setUser(res.user);
      setStatus("authenticated");
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // best-effort — même si l'appel échoue, on déconnecte localement
    }
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être utilisé à l'intérieur de <AuthProvider>");
  }
  return ctx;
}