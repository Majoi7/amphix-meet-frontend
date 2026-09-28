/**
 * Attribue une couleur d'avatar stable à partir d'un identifiant (userId
 * ou nom) — même personne = toujours la même couleur, personnes
 * différentes = couleurs différentes (dans la limite de la palette).
 * Palette volontairement distincte des couleurs "sémantiques" de
 * l'interface (rouge = erreur/couper, vert = rejoindre) pour ne pas créer
 * de confusion visuelle.
 */
const AVATAR_PALETTE = [
  "#8ab4f8", // bleu clair
  "#c58af9", // violet
  "#78d9ec", // cyan
  "#fdd663", // ambre
  "#f6aea9", // corail
  "#a8dab5", // vert doux
  "#fcad70", // orange
  "#b39ddb", // lavande
  "#ff8a80", // rouge pâle
  "#8bc34a", // vert lime
  "#4fc3f7", // bleu ciel
  "#ce93d8", // lilas
  "#ffb74d", // orange foncé
  "#a1887f", // brun grisâtre
  "#90a4ae", // bleu gris
  "#e57373", // rouge doux
];

export function getAvatarColor(identity: string): string {
  let hash = 0;
  for (let i = 0; i < identity.length; i++) {
    hash = identity.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

/* ══════════════════════════════════════════════════════════════════════
   RÉSOLUTION D'UN PROFIL — LA règle unique

   Photo si elle existe, sinon initiales + couleur. Cette règle était
   recopiée dans chaque composant, avec des variantes : la tuile lisait le
   metadata LiveKit, le panneau participants et le chat ne le lisaient pas
   du tout, et les initiales se calculaient tantôt sur une lettre, tantôt
   sur deux. Un même participant pouvait donc s'afficher différemment selon
   l'endroit de l'écran.

   Tout passe désormais par `resolveAvatar`.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Source affichable TELLE QUELLE par le navigateur : `http(s)://` ou
 * `data:image/…`. Sert aux valeurs qui viennent de l'API REST (`user.avatarUrl`),
 * où la data URL est légitime — elle ne traverse aucun token.
 */
export function isRenderableImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed);
}

/**
 * Source acceptable dans le METADATA d'un token LiveKit : `http(s)://`
 * uniquement.
 *
 * Le metadata voyage dans la query string du WebSocket. Une data URL y
 * ferait grossir le token jusqu'à faire refuser la connexion par le serveur.
 * C'est la seule différence avec `isRenderableImageUrl`, et elle est
 * volontaire.
 */
export function isMetadataAvatarUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

/** Initiales d'un nom, pour les avatars sans image. « Marie Dupont » → « MD ». */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}

/**
 * Lit `avatarUrl` dans le metadata LiveKit. Tolérant par construction : le
 * metadata est une chaîne produite ailleurs, et peut être vide, absent, ou
 * ne pas être du JSON du tout. Dans tous ces cas → `null`, donc initiales.
 */
export function parseAvatarMetadata(metadata: string | null | undefined): string | null {
  if (!metadata) return null;
  try {
    const parsed: unknown = JSON.parse(metadata);
    if (typeof parsed !== "object" || parsed === null) return null;
    const url = (parsed as { avatarUrl?: unknown }).avatarUrl;
    return isMetadataAvatarUrl(url) ? url.trim() : null;
  } catch {
    return null;
  }
}

export interface AvatarSource {
  /** Clé de la couleur. Doit être l'identité stable (userId), jamais un nom. */
  identity: string;
  /** Nom affiché — sert aux initiales. */
  name?: string | null;
  /** Metadata brut du participant LiveKit. */
  metadata?: string | null;
  /** URL déjà connue, venue de l'API REST (photo de son propre profil). */
  imageUrl?: string | null;
}

export interface ResolvedAvatar {
  /** `null` quand aucune photo exploitable n'existe → afficher les initiales. */
  photoUrl: string | null;
  initials: string;
  color: string;
}

/**
 * LA règle de résolution : photo si disponible, sinon initiales + couleur.
 *
 * Elle s'applique identiquement au participant LOCAL et aux participants
 * DISTANTS — leur metadata provient du même token, il n'y a donc aucune
 * raison de traiter le local à part.
 *
 * `imageUrl` (REST) prime sur le metadata : quand les deux sont présents,
 * c'est la valeur la plus fraîche, et la seule connue avant la connexion.
 */
export function resolveAvatar(source: AvatarSource): ResolvedAvatar {
  const identity = source.identity || "";
  const displayName = source.name?.trim() || identity || "?";
  const direct = isRenderableImageUrl(source.imageUrl) ? source.imageUrl.trim() : null;

  return {
    photoUrl: direct ?? parseAvatarMetadata(source.metadata),
    initials: initialsOf(displayName),
    color: getAvatarColor(identity),
  };
}
