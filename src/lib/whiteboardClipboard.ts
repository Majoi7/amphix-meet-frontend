import type { WhiteboardStroke } from "../types/whiteboard";

/**
 * Presse-papiers INTERNE au tableau blanc.
 *
 * Volontairement distinct du presse-papiers du système. Écrire dans ce
 * dernier demande une API asynchrone et, selon les navigateurs, une
 * permission ; le lire exposerait le contenu du presse-papiers de
 * l'utilisateur — qui n'a rien à voir avec le tableau. Un presse-papiers
 * interne ne soulève aucune de ces questions, reste strictement local à
 * l'onglet, et couvre tout ce que la fonctionnalité promet : copier, couper,
 * coller et dupliquer des traits DANS le tableau.
 *
 * L'état est au niveau du MODULE, et non dans une `useRef` : il doit survivre
 * à la fermeture du tableau. Copier un trait, revenir au Meet, rouvrir le
 * tableau et coller doit fonctionner.
 *
 * Le module ne connaît ni l'identité de l'auteur ni la génération
 * d'identifiants : recoller un trait exige un identifiant NEUF, et c'est
 * l'appelant qui l'attribue, avec l'auteur courant.
 */

/** Décalage appliqué à chaque collage, en unités monde. */
const PASTE_STEP = 28;

let clipboard: WhiteboardStroke[] | null = null;

/**
 * Nombre de collages effectués depuis la dernière copie.
 *
 * Il fait CASCADER les collages successifs. Sans lui, coller deux fois de
 * suite poserait la seconde copie exactement sur la première et l'utilisateur
 * croirait que rien ne s'est passé.
 */
let pasteCount = 0;

/**
 * Copie PROFONDE d'un trait.
 *
 * Les points doivent être de nouveaux objets : les partager avec le tableau
 * ferait que déplacer l'original déplacerait aussi la copie.
 */
function cloneStroke(stroke: WhiteboardStroke): WhiteboardStroke {
  return {
    ...stroke,
    points: stroke.points.map((point) => ({ x: point.x, y: point.y })),
  };
}

/** Copie les traits donnés. Renvoie le nombre de traits copiés (0 = rien). */
export function copyStrokes(strokes: WhiteboardStroke[]): number {
  if (strokes.length === 0) return 0;
  clipboard = strokes.map(cloneStroke);
  pasteCount = 0;
  return clipboard.length;
}

/** Y a-t-il de quoi coller ? */
export function hasClipboardContent(): boolean {
  return clipboard !== null && clipboard.length > 0;
}

/**
 * Les traits à coller, décalés pour CE collage.
 *
 * `id` est recopié tel quel — il est PÉRIMÉ et l'appelant DOIT le remplacer.
 * Le laisser en place ferait disparaître le collage chez tout le monde sauf
 * celui qui colle : un client ignore un message `stroke` dont l'identifiant
 * est déjà connu (voir le gestionnaire du canal dans `Whiteboard`), donc la
 * copie serait rejetée comme un doublon.
 */
export function readClipboardForPaste(): WhiteboardStroke[] {
  if (!clipboard || clipboard.length === 0) return [];

  pasteCount += 1;
  const offset = PASTE_STEP * pasteCount;

  return clipboard.map((stroke) => ({
    ...cloneStroke(stroke),
    points: stroke.points.map((point) => ({
      x: point.x + offset,
      y: point.y + offset,
    })),
  }));
}
