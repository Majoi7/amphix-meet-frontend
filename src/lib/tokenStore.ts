/**
 * L'access token vit UNIQUEMENT en mémoire (variable de module), jamais
 * dans localStorage ni sessionStorage — ça limite fortement le risque de
 * vol par XSS. Conséquence : au rechargement de la page, ce module repart
 * à zéro, mais AuthContext restaure automatiquement une nouvelle session
 * via le cookie httpOnly de refresh token (voir /api/v1/auth/refresh).
 */
let currentAccessToken: string | null = null;

export function getAccessToken(): string | null {
  return currentAccessToken;
}

export function setAccessToken(token: string | null): void {
  currentAccessToken = token;
}
