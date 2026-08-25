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

export async function rawRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include", // requis pour le cookie httpOnly de refresh token
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

/**
 * Requête authentifiée : attache l'access token en mémoire, et retente
 * UNE fois automatiquement après un refresh silencieux si le serveur
 * répond 401 (access token expiré, durée de vie 15 min).
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
      const refreshed = await rawRequest<{ accessToken: string }>("/api/v1/auth/refresh", {
        method: "POST",
      });
      setAccessToken(refreshed.accessToken);
      return rawRequest<T>(path, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${refreshed.accessToken}` },
      });
    }
    throw err;
  }
}
