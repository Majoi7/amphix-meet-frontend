/**
 * Base unique de l'API HTTP de l'application.
 *
 * Elle était recopiée à l'identique dans `api.ts` et `httpClient.ts`. Deux
 * copies de la même valeur finissent toujours par diverger — et surtout, une
 * troisième lecture était nécessaire ailleurs : la résolution des images
 * fabriquées par le backend (voir `resolveApiAssetUrl`). Une seule définition,
 * ici.
 */
export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:4000"
).replace(/\/+$/, "");

/**
 * Hôtes qui désignent la machine du VISITEUR, jamais le serveur.
 * `URL.hostname` normalise déjà `[::1]` en `[::1]`, on couvre les deux formes.
 */
const LOOPBACK_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

function isLoopback(url: URL): boolean {
  return LOOPBACK_HOSTNAMES.has(url.hostname);
}

/**
 * Résout une URL d'ASSET fabriquée par le backend contre la base d'API réelle.
 *
 * CAUSE RACINE DES PROFILS ABSENTS EN PRODUCTION :
 *
 * `avatarService` construit l'adresse d'un avatar à partir de la variable
 * `PUBLIC_API_URL`. Quand elle n'est pas définie — ce qui est le cas en
 * production — il retombe sur `http://localhost:<PORT>`. Cette adresse
 * désigne alors la machine du VISITEUR, pas le serveur : l'image ne se charge
 * jamais. Sur une page HTTPS, elle est en plus bloquée comme contenu mixte.
 * Le profil disparaissait donc exactement là où il devait servir, alors que
 * la donnée, elle, était bien présente dans le metadata du participant.
 *
 * On réécrit ces adresses vers la base que l'application utilise DÉJÀ pour
 * tous ses autres appels — celle qui fonctionne en production. En
 * développement, la base EST `localhost` : la valeur est rendue telle quelle
 * et rien ne change.
 *
 * Accepte également une URL relative (`/api/v1/avatars/…`), forme que le
 * backend émet désormais : elle ne fige aucun hôte et se résout contre la
 * base d'API, en dev comme en production.
 */
export function resolveApiAssetUrl(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Chemin serveur (`/api/…`). `//hôte/…` est une URL protocol-relative, pas
  // un chemin : on la laisse passer dans la branche absolue ci-dessous.
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return `${API_BASE_URL}${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!isLoopback(parsed)) return trimmed;

  // L'adresse désigne une machine locale. Si la base d'API, elle, est
  // distante, c'est que le backend a fabriqué une adresse faute de
  // configuration : on remplace l'origine fautive en gardant chemin et requête.
  try {
    const base = new URL(API_BASE_URL, window.location.origin);
    if (isLoopback(base)) return trimmed; // développement : l'adresse est la bonne
    return `${base.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return trimmed;
  }
}
