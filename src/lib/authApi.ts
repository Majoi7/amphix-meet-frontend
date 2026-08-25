import type { AuthUser, UserRole } from "../types";
import { rawRequest, authorizedRequest, ApiClientError } from "./httpClient";

export { ApiClientError };

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
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
