/**
 * Couleurs du tableau blanc : validation d'une saisie HEX et mémoire des
 * teintes récentes.
 *
 * Ce module ne définit AUCUNE palette. La grille de base reste `COLORS`,
 * déclarée dans `Whiteboard.tsx` et passée en propriété à `ColorPalette` :
 * une seule source de vérité, et rien à synchroniser.
 */

/** Un `#` facultatif, puis 3 ou 6 chiffres hexadécimaux. */
const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Normalise une saisie en `#rrggbb` minuscule, ou renvoie `null`.
 *
 * La forme abrégée est développée chiffre par chiffre (`#abc` → `#aabbcc`),
 * comme le veut la notation CSS. C'est ce qui garantit qu'une couleur retenue
 * ici est toujours acceptée telle quelle par `<input type="color">`, qui
 * refuse les formes courtes.
 */
export function normalizeHex(input: string): string | null {
  const match = HEX_PATTERN.exec(input.trim());
  if (!match) return null;

  const digits = match[1].toLowerCase();
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((d) => d + d)
          .join("")
      : digits;

  return `#${full}`;
}

/** Compare deux couleurs sans tenir compte de la casse. */
export function sameColor(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** Clé de stockage — propre au navigateur de l'utilisateur, jamais au compte. */
const STORAGE_KEY = "amphix-whiteboard-colors";

/** Au-delà, la rangée des récentes tient sur deux lignes sans être illisible. */
const MAX_RECENT = 8;

/**
 * Les couleurs récentes, de la plus récente à la plus ancienne.
 *
 * Tout est vérifié : la valeur stockée peut venir d'une version antérieure,
 * avoir été modifiée à la main, ou ne pas être du JSON du tout. Une entrée
 * invalide est simplement écartée — jamais propagée jusqu'à l'interface.
 *
 * `localStorage` peut aussi LEVER (navigation privée, stockage bloqué) : on
 * ne renvoie alors qu'une liste vide, ce qui dégrade la fonction sans la
 * casser.
 */
export function loadRecentColors(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => normalizeHex(value))
      .filter((value): value is string => value !== null)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/** Écrit la rangée. Silencieux en cas d'échec — voir `loadRecentColors`. */
export function saveRecentColors(colors: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {
    /* silencieux — la palette reste utilisable sans mémoire des récentes */
  }
}

/**
 * Place `hex` en tête des récentes et renvoie la nouvelle liste.
 *
 * Une couleur déjà présente est DÉPLACÉE, pas dupliquée : sans cela, alterner
 * entre deux teintes remplirait la rangée de doublons et en chasserait le
 * reste.
 *
 * Cette fonction est PURE, et c'est délibéré : elle est destinée à être
 * appelée depuis un updater de `setState`, que React StrictMode exécute deux
 * fois en développement. Une écriture `localStorage` placée ici serait donc
 * faite deux fois ; elle appartient à `saveRecentColors`, appelée depuis un
 * effet, une fois l'état engagé.
 */
export function addRecentColor(colors: string[], hex: string): string[] {
  return [hex, ...colors.filter((c) => !sameColor(c, hex))].slice(0, MAX_RECENT);
}
