/**
 * Mises en forme de l'espace d'administration.
 *
 * Toutes les fonctions sont pures et sans dépendance : elles ne font que
 * traduire des valeurs brutes en texte lisible. Aucune ne fabrique de
 * donnée — une valeur absente reste absente.
 */

/** Ce qu'on affiche quand la donnée n'existe pas côté serveur. */
export const UNAVAILABLE = "—";
/** Ce qu'on affiche quand la donnée existe en base mais n'est pas exposée. */
export const NOT_EXPOSED = "Non exposé";

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const TIME_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? DATE_TIME_FORMAT.format(date) : UNAVAILABLE;
}

export function formatDate(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? DATE_FORMAT.format(date) : UNAVAILABLE;
}

export function formatTime(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? TIME_FORMAT.format(date) : UNAVAILABLE;
}

/** « il y a 4 min », « il y a 3 h », « il y a 12 j ». */
export function formatRelative(iso: string | null | undefined, now = Date.now()): string {
  const date = parse(iso);
  if (!date) return UNAVAILABLE;

  const seconds = Math.round((now - date.getTime()) / 1000);
  if (seconds < 60) return "à l'instant";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;

  const days = Math.round(hours / 24);
  if (days < 31) return `il y a ${days} j`;

  return formatDate(iso);
}

/** « 1 h 24 », « 18 min », « 42 s ». `null` reste `null`. */
export function formatDuration(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms <= 0) return null;

  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;

  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, "0")}`;
}

/** Durée du format « 1 h 24 » ou « — » si indéterminée. */
export function formatDurationOrDash(ms: number | null | undefined): string {
  return formatDuration(ms) ?? UNAVAILABLE;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

/** Initiales d'un nom, pour les avatars sans image. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}
