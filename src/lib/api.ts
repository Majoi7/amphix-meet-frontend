import type { CreateRoomResponse, TokenResponse } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

class ApiClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
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
