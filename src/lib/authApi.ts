import type { AuthUser, UserRole } from "../types";
import { getAccessToken, setAccessToken } from "./tokenStore";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class ApiClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

async function rawRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    // Indispensable pour envoyer/recevoir le cookie httpOnly de refresh token.
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiClientError(body?.message ?? `Erreur ${res.status}`, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function register(input: {
  email: string;
  password: string;
  name: string;
  role: Extract<UserRole, "STUDENT" | "TEACHER">;
}): Promise<AuthResponse> {
  return rawRequest<AuthResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function login(input: { email: string; password: string }): Promise<AuthResponse> {
  return rawRequest<AuthResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function refreshSession(): Promise<AuthResponse> {
  return rawRequest<AuthResponse>("/api/v1/auth/refresh", { method: "POST" });
}

export function logout(): Promise<void> {
  return rawRequest<void>("/api/v1/auth/logout", { method: "POST" });
}

/**
 * Requête authentifiée : attache l'access token courant, et si le serveur
 * répond 401 (token expiré — durée de vie 15 min), tente UNE fois un
 * refresh silencieux via le cookie avant de réessayer. Évite de
 * déconnecter l'utilisateur juste parce qu'il est resté sur la page plus
 * de 15 minutes.
 */
export async function authorizedRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();
  try {
    return await rawRequest<T>(path, {
      ...options,
      headers: { ...options.headers, Authorization: token ? `Bearer ${token}` : "" },
    });
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 401) {
      const refreshed = await refreshSession();
      setAccessToken(refreshed.accessToken);
      return rawRequest<T>(path, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${refreshed.accessToken}` },
      });
    }
    throw err;
  }
}

export function getMe(): Promise<{ user: AuthUser }> {
  return authorizedRequest<{ user: AuthUser }>("/api/v1/auth/me", { method: "GET" });
}

export function updateMe(input: {
  name?: string;
  avatarUrl?: string;
}): Promise<{ user: AuthUser }> {
  return authorizedRequest<{ user: AuthUser }>("/api/v1/auth/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}