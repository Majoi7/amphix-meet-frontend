import type { CreateRoomResponse, TokenResponse } from "../types";
import { getAccessToken } from "./tokenStore";
import { API_BASE_URL } from "./apiBase";

class ApiClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // Prépare la Phase 2 : ces endpoints ne sont pas encore protégés côté
  // backend, mais on attache déjà l'access token — quand /api/rooms et
  // /api/token migreront sous /api/v1 avec requireAuth, rien à changer ici.
  const token = getAccessToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiClientError(
      body?.message ?? `Erreur ${res.status} lors de l'appel à ${path}`
    );
  }

  return res.json() as Promise<T>;
}

export function createRoom(): Promise<CreateRoomResponse> {
  return request<CreateRoomResponse>("/api/rooms", { method: "POST" });
}

export function fetchToken(
  roomId: string,
  participantName: string
): Promise<TokenResponse> {
  return request<TokenResponse>("/api/token", {
    method: "POST",
    body: JSON.stringify({ roomId, participantName }),
  });
}
