import type { WhiteboardPoint, WhiteboardStroke } from "../types/whiteboard";

/**
 * Détection géométrique des traits du tableau blanc.
 *
 * Ce module remplace le test par boîte englobante utilisé auparavant : une
 * boîte englobante dit « le point est dans le rectangle qui contient le
 * trait », pas « le point est sur le trait ». Un L, une diagonale ou un
 * cercle se « touchaient » donc en cliquant dans le vide.
 *
 * Toutes les distances sont exprimées en UNITÉS MONDE (celles des points du
 * trait). C'est à l'appelant de convertir sa tolérance depuis les pixels
 * écran, via `strokeTouchTolerance`.
 */

export interface StrokeBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const EMPTY_BOUNDS: StrokeBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

/**
 * Boîte englobante, calculée en BOUCLE.
 *
 * L'ancienne version faisait `Math.min(...xs)` : l'étalement d'arguments
 * passe par la pile d'appels et lève `RangeError: Maximum call stack size
 * exceeded` au-delà de ~65 000 points — un trait tracé au doigt sur un canvas
 * infini peut y arriver, ce qui faisait planter tout le rendu.
 */
export function getStrokeBounds(stroke: WhiteboardStroke): StrokeBounds {
  const points = stroke.points;
  if (points.length === 0) return EMPTY_BOUNDS;

  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return { minX, maxX, minY, maxY };
}

export function boundsIntersect(a: StrokeBounds, b: StrokeBounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/**
 * Distance d'un point au SEGMENT [a, b] — et non à la droite infinie qui le
 * porte : sans le bornage de `t`, un point situé loin dans le prolongement
 * d'un segment court serait considéré comme « sur » le trait.
 */
export function pointSegmentDistance(
  p: WhiteboardPoint,
  a: WhiteboardPoint,
  b: WhiteboardPoint
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;

  // Segment dégénéré (deux points confondus) : distance ponctuelle.
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  // Projection orthogonale de p sur la droite, ramenée dans [0, 1].
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;

  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distance minimale à une polyligne, en testant chaque paire consécutive. */
function polylineDistance(points: WhiteboardPoint[], p: WhiteboardPoint): number {
  if (points.length === 0) return Number.POSITIVE_INFINITY;
  if (points.length === 1) return Math.hypot(p.x - points[0].x, p.y - points[0].y);

  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < points.length; i++) {
    const d = pointSegmentDistance(p, points[i - 1], points[i]);
    if (d < best) best = d;
  }
  return best;
}

/** Rectangle : les quatre côtés, jamais l'intérieur. */
function rectangleDistance(stroke: WhiteboardStroke, p: WhiteboardPoint): number {
  const a = stroke.points[0];
  const b = stroke.points[stroke.points.length - 1];
  if (!a || !b) return Number.POSITIVE_INFINITY;

  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);

  const corners: WhiteboardPoint[] = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];

  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < corners.length; i++) {
    const d = pointSegmentDistance(p, corners[i], corners[(i + 1) % corners.length]);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Ellipse (l'outil « cercle » trace en réalité une ellipse inscrite dans le
 * rectangle de balayage — c'est ce que fait `drawStroke`).
 *
 * La distance exacte d'un point à une ellipse n'a pas de forme fermée
 * simple. On ramène le point dans l'espace du cercle unité : le rayon y vaut
 * 1, donc `|‖(nx,ny)‖ − 1|` mesure l'écart relatif. Le facteur de conversion
 * est le PLUS PETIT demi-axe, ce qui sous-estime la distance le long du grand
 * axe : la gomme y est donc légèrement plus généreuse, jamais plus stricte
 * que la réalité. C'est le sens de l'erreur qu'on veut pour un effacement.
 */
function ellipseDistance(stroke: WhiteboardStroke, p: WhiteboardPoint): number {
  const a = stroke.points[0];
  const b = stroke.points[stroke.points.length - 1];
  if (!a || !b) return Number.POSITIVE_INFINITY;

  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;

  if (rx === 0 && ry === 0) return Math.hypot(p.x - cx, p.y - cy);

  // Ellipse dégénérée en segment (balayage horizontal ou vertical nul).
  if (rx === 0 || ry === 0) {
    return pointSegmentDistance(
      p,
      { x: cx - rx, y: cy - ry },
      { x: cx + rx, y: cy + ry }
    );
  }

  const nx = (p.x - cx) / rx;
  const ny = (p.y - cy) / ry;
  return Math.abs(Math.hypot(nx, ny) - 1) * Math.min(rx, ry);
}

/** Distance minimale du point au trait, selon l'outil qui l'a produit. */
export function strokeDistance(stroke: WhiteboardStroke, p: WhiteboardPoint): number {
  if (stroke.points.length === 0) return Number.POSITIVE_INFINITY;

  switch (stroke.tool) {
    case "rectangle":
      return rectangleDistance(stroke, p);
    case "circle":
      return ellipseDistance(stroke, p);
    case "line": {
      const a = stroke.points[0];
      const b = stroke.points[stroke.points.length - 1];
      return a === b ? Math.hypot(p.x - a.x, p.y - a.y) : pointSegmentDistance(p, a, b);
    }
    default:
      // pencil, eraser (traits historiques), function : ce sont des polylignes.
      return polylineDistance(stroke.points, p);
  }
}

/**
 * Tolérance de contact d'un trait, en unités monde.
 *
 * `Math.max(stroke.width, 8) / zoom` garantit au moins 8 pixels écran de
 * marge, même pour un trait d'un pixel : sans ce plancher, un trait très fin
 * serait impossible à viser. `extraPx` élargit encore la zone (rayon de la
 * gomme).
 */
export function strokeTouchTolerance(
  stroke: WhiteboardStroke,
  zoom: number,
  extraPx = 0
): number {
  return (Math.max(stroke.width, 8) + extraPx) / zoom;
}

/** Le point touche-t-il le trait, à la tolérance donnée (unités monde) ? */
export function hitTestStroke(
  stroke: WhiteboardStroke,
  world: WhiteboardPoint,
  tolerance: number
): boolean {
  return strokeDistance(stroke, world) <= tolerance;
}

/**
 * Tous les traits touchés par le point, du plus récent au plus ancien.
 * La gomme en efface plusieurs d'un coup ; la sélection ne retient que le
 * premier (le plus au-dessus).
 */
export function findStrokesAt(
  strokes: readonly WhiteboardStroke[],
  world: WhiteboardPoint,
  zoom: number,
  extraPx = 0
): WhiteboardStroke[] {
  const hits: WhiteboardStroke[] = [];
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    if (hitTestStroke(stroke, world, strokeTouchTolerance(stroke, zoom, extraPx))) {
      hits.push(stroke);
    }
  }
  return hits;
}

/** Le trait le plus récent touché par le point, ou `undefined`. */
export function findStrokeAt(
  strokes: readonly WhiteboardStroke[],
  world: WhiteboardPoint,
  zoom: number,
  extraPx = 0
): WhiteboardStroke | undefined {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    if (hitTestStroke(stroke, world, strokeTouchTolerance(stroke, zoom, extraPx))) {
      return stroke;
    }
  }
  return undefined;
}
