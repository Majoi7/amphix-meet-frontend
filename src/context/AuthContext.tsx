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
import { onSessionExpired } from "../lib/httpClient";
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
  updateProfile: (input: { name?: string; avatarUrl?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

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

  /**
   * FIN DE SESSION DÉCIDÉE PAR LE CLIENT.
   *
   * Quand le renouvellement est refusé — un 401 sur `/auth/refresh` —, la
   * session est morte et rien ne la ressuscitera. `httpClient` le signale
   * ici, et ce composant remet l'état local à zéro : le jeton en mémoire
   * disparaît, `status` passe à `unauthenticated`, et `RequireAuth`
   * ramène l'utilisateur à l'écran de connexion.
   *
   * On ne rappelle PAS `/auth/logout` : le refresh token est déjà révoqué
   * ou expiré côté serveur, l'appel n'aurait rien à révoquer. Et sur une
   * session déjà morte il ne ferait qu'un aller-retour de plus.
   *
   * Une seule notification par renouvellement — la promesse partagée de
   * `httpClient` garantit qu'il n'y a qu'un renouvellement en vol —, et
   * cette remise à zéro est idempotente : la recevoir deux fois ne
   * déclencherait pas deux déconnexions, seulement deux fois le même état.
   */
  useEffect(() => {
    return onSessionExpired(() => {
      setAccessToken(null);
      setUser(null);
      setStatus("unauthenticated");
    });
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

  const updateProfile = useCallback(
    async (input: { name?: string; avatarUrl?: string }) => {
      const res = await authApi.updateMe(input);
      setUser(res.user);
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{ user, status, login, register, logout, updateProfile }}
    >
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