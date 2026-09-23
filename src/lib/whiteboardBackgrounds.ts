/**
 * Registre des fonds du tableau blanc.
 *
 * Un fond appartient au « sheet-world » : la feuille de travail commune, de
 * taille logique fixe, sur laquelle vivent les dessins. Il n'est JAMAIS un
 * `WhiteboardStroke` — il n'est donc jamais sélectionnable, jamais effacé par
 * la gomme, jamais dans l'historique undo/redo, et il ne peut pas être
 * confondu avec un dessin.
 *
 * Ajouter un fond = ajouter une entrée ici + déposer l'asset dans
 * `public/backgrounds/`. Aucun autre fichier à toucher.
 */

export interface WhiteboardBackgroundDefinition {
  id: string;
  label: string;
  /**
   * `image` : un chemin servi depuis `public/`. `color` : une couleur CSS.
   *
   * Les trois fonds actuels sont des `image` ; la variante `color` reste
   * supportée par le rendu et les miniatures, mais n'est plus utilisée.
   */
  kind: "color" | "image";
  /** Couleur CSS, ou URL de l'asset (jamais un import : `public/` n'entre pas dans le bundle). */
  value: string;
  /** Traits de cahier par-dessus le fond. Réservé aux fonds clairs et unis :
   *  sur une illustration, une grille ne ferait que salir l'image. */
  grid?: boolean;
}

/**
 * Dimensions logiques de la feuille, en unités monde.
 *
 * Elles coïncident VOLONTAIREMENT avec `WHITEBOARD_LEGACY_WIDTH/HEIGHT` : les
 * documents enregistrés au format normalisé 0..1 ont été convertis en
 * [0,1600]×[0,900], donc une feuille placée exactement sur ce rectangle fait
 * retomber les anciens dessins pile dessus. Changer ces valeurs décalerait
 * tout le contenu historique.
 */
export const SHEET_WIDTH = 1600;
export const SHEET_HEIGHT = 900;
export const SHEET_MIN_X = 0;
export const SHEET_MIN_Y = 0;

/**
 * Les trois fonds sont servis en SVG depuis `public/backgrounds/`. Copiés
 * TELS QUELS depuis `design/` : ni re-encodés, ni reconvertis, ni modifiés.
 *
 * Ils restent dessinables par `ctx.drawImage` parce que chacun porte des
 * attributs `width`/`height` explicites : sans dimensions intrinsèques, un SVG
 * chargé dans une `<img>` n'a rien à rasteriser et `drawImage` ne peint rien.
 * Servis depuis notre propre origine, ils ne souillent pas le canvas — le
 * partage d'écran (`captureStream`) continue donc de fonctionner.
 */
export const WHITEBOARD_BACKGROUNDS: readonly WhiteboardBackgroundDefinition[] = [
  {
    id: "fond01",
    label: "Papier uni",
    kind: "image",
    value: "/backgrounds/fond01.svg",
    // Rectangle blanc : les traits de cahier restent pertinents par-dessus.
    grid: true,
  },
  {
    id: "fond02",
    label: "Fond 02",
    kind: "image",
    value: "/backgrounds/fond02.svg",
  },
  {
    id: "fond03",
    label: "Fond 03",
    kind: "image",
    value: "/backgrounds/fond03.svg",
  },
] as const;

/** Fond utilisé quand aucun n'a été choisi, ou quand l'identifiant est inconnu
 *  (document ancien, ou participant dont la version ne connaît pas ce fond). */
export const DEFAULT_BACKGROUND_ID = "fond01";

const DEFAULT_BACKGROUND: WhiteboardBackgroundDefinition =
  WHITEBOARD_BACKGROUNDS.find((b) => b.id === DEFAULT_BACKGROUND_ID) ??
  WHITEBOARD_BACKGROUNDS[0];

/**
 * Résout un identifiant en définition.
 *
 * Un identifiant absent OU inconnu retombe sur le fond par défaut : un
 * document ancien (sans champ `background`) et un message reçu d'une version
 * plus récente s'affichent donc correctement, sans erreur. C'est ce qui rend
 * le message `background` idempotent et sûr.
 */
export function getBackground(id: string | null | undefined): WhiteboardBackgroundDefinition {
  if (!id) return DEFAULT_BACKGROUND;
  return WHITEBOARD_BACKGROUNDS.find((b) => b.id === id) ?? DEFAULT_BACKGROUND;
}

export function isKnownBackgroundId(id: string): boolean {
  return WHITEBOARD_BACKGROUNDS.some((b) => b.id === id);
}

// ── Cache d'images ────────────────────────────────────────────────────────
// Une seule `Image()` par URL, pour toute la durée de vie du module. Sans ce
// cache, chaque rendu relancerait le décodage de plusieurs mégaoctets.

const imageCache = new Map<string, HTMLImageElement>();
const readyListeners = new Set<() => void>();

function ensureImage(url: string): HTMLImageElement | null {
  const cached = imageCache.get(url);
  if (cached) {
    // `naturalWidth > 0` distingue une image décodée d'une image en cours de
    // chargement (ou en échec) : dans les deux autres cas il n'y a rien à
    // dessiner, et on redessinera à l'événement.
    return cached.complete && cached.naturalWidth > 0 ? cached : null;
  }
  if (typeof Image === "undefined") return null;

  const img = new Image();
  img.decoding = "async";
  const notify = () => {
    for (const listener of readyListeners) listener();
  };
  // `once` sur les deux issues : en cas d'échec on prévient une fois, sans
  // jamais relancer de chargement (l'entrée reste en cache), donc pas de
  // boucle de requêtes sur un asset manquant.
  img.addEventListener("load", notify, { once: true });
  img.addEventListener("error", notify, { once: true });
  img.src = url;
  imageCache.set(url, img);
  return null;
}

/**
 * Image prête à dessiner, ou `null` si elle n'est pas encore décodée.
 * Déclenche le chargement au premier appel, puis sert le cache.
 */
export function getReadyBackgroundImage(
  definition: WhiteboardBackgroundDefinition
): HTMLImageElement | null {
  if (definition.kind !== "image") return null;
  return ensureImage(definition.value);
}

/** Prévient quand une image de fond devient disponible (ou échoue), pour
 *  redessiner le canvas une fois — et une seule. */
export function subscribeBackgroundImages(listener: () => void): () => void {
  readyListeners.add(listener);
  return () => {
    readyListeners.delete(listener);
  };
}
