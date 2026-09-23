import { compileFunction, evaluateConstant } from "./index";
import {
  RENDERED_KINDS,
  allocateColor,
  allocateLabel,
  type MathConstruction,
  type MathObject,
  type MathObjectKind,
  type MathView,
} from "./construction";

/**
 * GÉOMÉTRIE — ce que chaque objet SIGNIFIE, en nombres.
 *
 * Ce module est PUR : aucun import de jsxgraph, aucun accès au DOM, aucune
 * fonction qui lève. Il transforme une liste d'objets en un ensemble de
 * PRIMITIVES géométriques (un point, une droite, un cercle) que le renderer
 * n'aura plus qu'à dessiner.
 *
 * C'est la seule frontière qui compte : le renderer ne calcule RIEN. Il ne
 * décide ni où est un point, ni où deux droites se coupent, ni quel est le
 * rayon d'un cercle. Il reçoit des nombres et les trace. Déplacer un point,
 * c'est donc changer le modèle — jamais retoucher un élément graphique.
 *
 * Ce module porte aussi les CONVERSIONS pixel ↔ monde, et lui seul : les
 * disperser dans les composants ferait diverger les tolérances de clic d'un
 * panneau à l'autre.
 */

// ── Primitives ────────────────────────────────────────────────────────────

export interface WorldPoint {
  x: number;
  y: number;
}

/** Unités de monde par pixel, par axe. Les deux diffèrent car le plateau
 *  n'impose pas de rapport d'aspect : un même nombre de pixels ne vaut pas la
 *  même distance en x et en y. */
export interface PixelScale {
  x: number;
  y: number;
}

/**
 * Une primitive géométrique, exprimée UNIQUEMENT en nombres.
 *
 * `linear` couvre le segment ET la droite : mêmes mathématiques, seul le
 * domaine du paramètre change. `direction` est le vecteur complet (et non un
 * vecteur unitaire) pour que `t` s'entende directement : `t = 0` à l'origine,
 * `t = 1` à l'extrémité, et `t ∈ [0, 1]` exactement quand `bounded`.
 */
export type Geometry =
  | { kind: "function"; source: string; evaluate: (x: number) => number }
  | { kind: "point"; at: WorldPoint }
  | { kind: "linear"; origin: WorldPoint; direction: WorldPoint; bounded: boolean }
  | { kind: "circle"; center: WorldPoint; radius: number };

export type LinearGeometry = Extract<Geometry, { kind: "linear" }>;
export type CircleGeometry = Extract<Geometry, { kind: "circle" }>;

/**
 * Les deux points entre lesquels le renderer trace une primitive linéaire.
 *
 * Pour un segment, ce sont ses extrémités. Pour une droite, ils ne bornent
 * rien : ils définissent sa direction. Le renderer n'a donc aucune arithmétique
 * vectorielle à faire — il reçoit deux points et les relie.
 */
export function linearAnchors(line: LinearGeometry): [WorldPoint, WorldPoint] {
  return [
    line.origin,
    { x: line.origin.x + line.direction.x, y: line.origin.y + line.direction.y },
  ];
}

/**
 * Centre et point de passage d'un cercle.
 *
 * Le second est construit sur l'axe des abscisses : c'est la convention la plus
 * simple qui donne le bon rayon, et il reste INVISIBLE — le modèle, lui, garde
 * le vrai point de passage comme objet à part entière.
 */
export function circleAnchors(circle: CircleGeometry): [WorldPoint, WorldPoint] {
  return [
    circle.center,
    { x: circle.center.x + circle.radius, y: circle.center.y },
  ];
}

// ── Algèbre de points ─────────────────────────────────────────────────────

/**
 * Marge des comparaisons géométriques. Les prédicats ne la comparent jamais à
 * zéro dans l'absolu : une pente de 1e-12 et un déterminant de 1e-12 n'ont pas
 * la même signification selon la taille des vecteurs en jeu. `scaledZero`
 * rapporte donc la marge à l'échelle des grandeurs comparées.
 */
const EPS = 1e-9;

function scaledZero(value: number, scale: number): boolean {
  return Math.abs(value) <= EPS * Math.max(1, scale);
}

function add(a: WorldPoint, b: WorldPoint): WorldPoint {
  return { x: a.x + b.x, y: a.y + b.y };
}

function sub(a: WorldPoint, b: WorldPoint): WorldPoint {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scaleVec(vector: WorldPoint, factor: number): WorldPoint {
  return { x: vector.x * factor, y: vector.y * factor };
}

function dot(a: WorldPoint, b: WorldPoint): number {
  return a.x * b.x + a.y * b.y;
}

/** Produit vectoriel en 2D : mesure l'écart d'orientation des deux vecteurs. */
function cross(a: WorldPoint, b: WorldPoint): number {
  return a.x * b.y - a.y * b.x;
}

function length(vector: WorldPoint): number {
  return Math.hypot(vector.x, vector.y);
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

// ── Ordre canonique des solutions ─────────────────────────────────────────

/**
 * Quantum d'arrondi de l'ordre canonique. On trie sur des entiers : deux
 * valeurs distantes de 1e-12 — le bruit habituel d'un calcul flottant — sont
 * ainsi considérées comme ÉGALES, et l'ordre ne dépend donc pas de cet écart.
 * Sans cela, deux rendus successifs pourraient échanger la solution 1 et la
 * solution 2, et `branch` désignerait tantôt l'une tantôt l'autre.
 */
const ORDER_QUANTUM = 1e9;

/** Tolérance de fusion de deux solutions : deux points plus proches que cela
 *  sont le MÊME point — c'est le cas d'une tangence, où le discriminant
 *  donne deux racines confondues. */
const MERGE_EPSILON = 1e-7;

/**
 * Range des solutions dans un ordre CANONIQUE : croissant en x, puis en y.
 *
 * C'est cette fonction, et non l'ordre de retour d'une bibliothèque, qui
 * définit ce qu'est « la solution 1 ». L'identité d'une intersection est donc
 * stable : elle ne dépend que des nombres, jamais du chemin de calcul.
 *
 * Les solutions confondues sont fusionnées — une tangente a UN point de
 * contact, pas deux.
 */
export function orderPoints(points: readonly WorldPoint[]): WorldPoint[] {
  const sorted = [...points].sort((a, b) => {
    const ax = Math.round(a.x * ORDER_QUANTUM);
    const bx = Math.round(b.x * ORDER_QUANTUM);
    if (ax !== bx) return ax - bx;
    const ay = Math.round(a.y * ORDER_QUANTUM);
    const by = Math.round(b.y * ORDER_QUANTUM);
    return ay - by;
  });

  const unique: WorldPoint[] = [];
  for (const point of sorted) {
    const previous = unique[unique.length - 1];
    if (
      previous &&
      Math.abs(previous.x - point.x) < MERGE_EPSILON &&
      Math.abs(previous.y - point.y) < MERGE_EPSILON
    ) {
      continue;
    }
    unique.push(point);
  }
  return unique;
}

// ── Intersections ─────────────────────────────────────────────────────────

/**
 * Résultat d'une intersection. Trois issues, et aucune n'est une exception :
 * `infinite` n'est pas une variante de `ok`, c'est l'impossibilité de
 * représenter la réponse par des points — deux objets confondus se coupent
 * partout.
 */
export type IntersectionResult =
  | { status: "ok"; points: WorldPoint[] }
  | { status: "none"; reason: string }
  | { status: "infinite"; reason: string };

/** Un paramètre est-il dans le domaine du segment ? La marge évite qu'un
 *  point d'intersection posé exactement sur une extrémité soit rejeté par le
 *  bruit de calcul. */
function withinExtent(t: number, bounded: boolean): boolean {
  return !bounded || (t >= -EPS && t <= 1 + EPS);
}

function intersectLinear(a: LinearGeometry, b: LinearGeometry): IntersectionResult {
  const denominator = cross(a.direction, b.direction);
  const scale = length(a.direction) * length(b.direction);
  const offset = sub(b.origin, a.origin);

  if (scaledZero(denominator, scale)) {
    // Directions parallèles. Reste à savoir si elles portent la même droite :
    // c'est le cas si l'écart entre les origines est lui aussi porté par la
    // direction.
    if (scaledZero(cross(offset, a.direction), length(offset) * length(a.direction))) {
      return {
        status: "infinite",
        reason: "Ces deux objets sont confondus : ils ont une infinité de points communs.",
      };
    }
    return {
      status: "none",
      reason: "Ces deux objets sont parallèles : ils ne se coupent pas.",
    };
  }

  const ta = cross(offset, b.direction) / denominator;
  const tb = cross(offset, a.direction) / denominator;

  if (!withinExtent(ta, a.bounded) || !withinExtent(tb, b.bounded)) {
    return {
      status: "none",
      reason:
        "Les supports se coupent, mais le point d'intersection tombe en dehors du segment.",
    };
  }

  // Sur une extrémité, on ramène le paramètre EXACTEMENT à 0 ou 1 : le point
  // obtenu est alors celui du sommet, sans résidu flottant.
  const t = a.bounded ? clamp01(ta) : ta;
  return { status: "ok", points: [add(a.origin, scaleVec(a.direction, t))] };
}

function intersectLinearCircle(
  line: LinearGeometry,
  circle: CircleGeometry
): IntersectionResult {
  const fromCenter = sub(line.origin, circle.center);
  const direction = line.direction;
  const quadratic = dot(direction, direction);

  if (scaledZero(quadratic, 1)) {
    return { status: "none", reason: "La droite est mal définie : ses deux points sont confondus." };
  }

  const linear = 2 * dot(fromCenter, direction);
  const constant =
    dot(fromCenter, fromCenter) - circle.radius * circle.radius;
  const discriminant = linear * linear - 4 * quadratic * constant;
  const scale = linear * linear + Math.abs(4 * quadratic * constant);

  if (discriminant < 0 && !scaledZero(discriminant, scale)) {
    return {
      status: "none",
      reason: "Ces deux objets ne se coupent pas : la droite passe à côté du cercle.",
    };
  }

  const roots: number[] = [];
  if (scaledZero(discriminant, scale)) {
    // Tangente : une racine double, donc UN point de contact.
    roots.push(-linear / (2 * quadratic));
  } else {
    const root = Math.sqrt(discriminant);
    roots.push((-linear - root) / (2 * quadratic));
    roots.push((-linear + root) / (2 * quadratic));
  }

  const points: WorldPoint[] = [];
  for (const root of roots) {
    if (!withinExtent(root, line.bounded)) continue;
    const t = line.bounded ? clamp01(root) : root;
    points.push(add(line.origin, scaleVec(direction, t)));
  }

  if (points.length === 0) {
    return {
      status: "none",
      reason:
        "Les supports se coupent, mais les points d'intersection tombent en dehors du segment.",
    };
  }

  return { status: "ok", points: orderPoints(points) };
}

function intersectCircleCircle(
  a: CircleGeometry,
  b: CircleGeometry
): IntersectionResult {
  const betweenCenters = sub(b.center, a.center);
  const distance = length(betweenCenters);
  const radiusSum = a.radius + b.radius;
  const radiusGap = Math.abs(a.radius - b.radius);

  if (scaledZero(distance, radiusSum) && scaledZero(radiusGap, radiusSum)) {
    return {
      status: "infinite",
      reason: "Ces deux cercles sont confondus : ils ont une infinité de points communs.",
    };
  }
  if (scaledZero(distance, radiusSum)) {
    return {
      status: "none",
      reason: "Ces deux cercles sont concentriques : ils ne se coupent pas.",
    };
  }
  if (distance > radiusSum + EPS * Math.max(1, radiusSum)) {
    return {
      status: "none",
      reason: "Ces deux cercles sont trop éloignés : ils ne se coupent pas.",
    };
  }
  if (distance < radiusGap - EPS * Math.max(1, radiusGap)) {
    return {
      status: "none",
      reason: "L'un des cercles est entièrement à l'intérieur de l'autre : ils ne se coupent pas.",
    };
  }

  // Distance du centre A à la corde des points d'intersection.
  const along =
    (distance * distance + a.radius * a.radius - b.radius * b.radius) / (2 * distance);
  const heightSquared = a.radius * a.radius - along * along;
  const base = add(a.center, scaleVec(betweenCenters, along / distance));

  if (scaledZero(heightSquared, a.radius * a.radius)) {
    // Tangence intérieure ou extérieure : un seul point de contact.
    return { status: "ok", points: [base] };
  }

  const height = Math.sqrt(Math.max(0, heightSquared));
  const normal = { x: -betweenCenters.y / distance, y: betweenCenters.x / distance };
  return {
    status: "ok",
    points: orderPoints([
      add(base, scaleVec(normal, height)),
      add(base, scaleVec(normal, -height)),
    ]),
  };
}

/**
 * Intersection de deux primitives.
 *
 * Les courbes de fonction en sont exclues, et ce n'est pas un oubli : couper
 * une courbe demande une recherche de racines numériques, avec ses propres
 * questions de convergence et de multiplicité. L'annoncer clairement vaut
 * mieux que de renvoyer une approximation dont personne ne saurait dire ce
 * qu'elle vaut.
 */
export function intersectShapes(a: Geometry, b: Geometry): IntersectionResult {
  if (a.kind === "function" || b.kind === "function") {
    return {
      status: "none",
      reason:
        "Une courbe de fonction ne participe pas encore aux intersections : le moteur ne cherche pas encore de racines.",
    };
  }
  if (a.kind === "point" || b.kind === "point") {
    return {
      status: "none",
      reason: "Un point n'a pas de support à couper : choisis deux droites, segments ou cercles.",
    };
  }

  // Il ne reste que des droites/segments et des cercles : les quatre
  // combinaisons sont couvertes, chacune une seule fois.
  if (a.kind === "linear") {
    return b.kind === "circle" ? intersectLinearCircle(a, b) : intersectLinear(a, b);
  }
  if (b.kind === "linear") return intersectLinearCircle(b, a);
  return intersectCircleCircle(a, b);
}

// ── Lecture des définitions ───────────────────────────────────────────────

/**
 * Retire une paire de parenthèses qui enveloppe TOUTE l'expression.
 *
 * `"(2, 3)"` doit se lire comme un point, pas comme « il manque la virgule » :
 * sans ce décapage, la virgule serait vue à l'intérieur d'un groupe. Les
 * parenthèses qui ne se referment pas à la fin — `"(1+2), 3"` — sont laissées
 * en place, car elles appartiennent bien à une sous-expression.
 */
function stripOuterParentheses(source: string): string {
  if (!source.startsWith("(") || !source.endsWith(")")) return source;

  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    else if (source[index] === ")") {
      depth -= 1;
      if (depth === 0 && index < source.length - 1) return source;
    }
  }
  return depth === 0 ? source.slice(1, -1) : source;
}

/** Découpe aux virgules de premier niveau, en ignorant celles qui sont
 *  imbriquées dans des parenthèses. */
function splitTopLevelComma(source: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    else if (character === "," && depth === 0) {
      parts.push(source.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(source.slice(start));
  return parts;
}

export type PointParse =
  | { ok: true; point: WorldPoint }
  | { ok: false; reason: string };

/**
 * Lit la définition d'un point : deux coordonnées séparées par une virgule.
 *
 * POURQUOI LE DÉCOUPAGE EST FAIT ICI, ET NON PAR LE MOTEUR
 *
 * Le moteur d'évaluation traite la virgule comme un SÉPARATEUR DÉCIMAL — c'est
 * un choix assumé, documenté dans l'en-tête de `tokenizer.ts`, pour qu'un
 * utilisateur francophone puisse écrire « 1,5 ». Conséquence directe :
 * `evaluateConstant("2,3")` ne renvoie pas une erreur, il renvoie `2.3`. Un
 * point mal découpé ne planterait donc pas : il se placerait silencieusement
 * au mauvais endroit, ce qui est bien pire.
 *
 * La règle est donc posée une fois pour toutes, et elle est simple : DANS UNE
 * DÉFINITION DE POINT, LA VIRGULE SÉPARE. Le séparateur décimal y est le
 * point. `formatPointDefinition` écrit toujours cette forme, donc l'aller et
 * le retour sont sans ambiguïté, et l'utilisateur voit sous ses yeux la
 * syntaxe qu'il doit employer.
 */
export function parsePointDefinition(definition: string): PointParse {
  const source = definition.trim();
  if (source === "") {
    return { ok: false, reason: "Aucune coordonnée saisie." };
  }

  const parts = splitTopLevelComma(stripOuterParentheses(source));

  if (parts.length === 1) {
    return {
      ok: false,
      reason:
        "Il manque la virgule entre l'abscisse et l'ordonnée. Écris par exemple « 2.5, 3 ».",
    };
  }
  if (parts.length > 2) {
    return { ok: false, reason: "Un point attend exactement deux coordonnées." };
  }

  const abscissa = evaluateConstant(parts[0]);
  if (abscissa.status !== "ok") {
    return { ok: false, reason: `Abscisse : ${abscissa.message}` };
  }
  const ordinate = evaluateConstant(parts[1]);
  if (ordinate.status !== "ok") {
    return { ok: false, reason: `Ordonnée : ${ordinate.message}` };
  }

  const at = { x: abscissa.approximateValue, y: ordinate.approximateValue };
  if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) {
    return { ok: false, reason: "Les coordonnées ne sont pas des nombres finis." };
  }
  return { ok: true, point: at };
}

/** Écrit une définition de point dans la syntaxe que `parsePointDefinition`
 *  relit : virgule de séparation, point décimal. */
export function formatPointDefinition(point: WorldPoint): string {
  return `${formatCoordinate(point.x)}, ${formatCoordinate(point.y)}`;
}

function formatCoordinate(value: number): string {
  // `String` d'un double est exact et réversible : il n'y a rien à arrondir
  // ici. Le seul cas à traiter est le zéro négatif, que « -0 » rendrait
  // déroutant à l'écran.
  return String(value === 0 ? 0 : value);
}

/**
 * Précision d'un point posé au clic : deux décimales.
 *
 * Un clic ne peut pas exprimer davantage, et des coordonnées rondes ont un
 * avantage décisif — elles sont vérifiables à la main. `(2, 3)` se contrôle
 * d'un coup d'œil ; `(2.0347291, 3.0011902)` ne se contrôle pas.
 */
export function roundToClickPrecision(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

// ── Conversions pixel ↔ monde ─────────────────────────────────────────────

/**
 * Échelle du plateau : combien d'unités de monde vaut un pixel, par axe.
 *
 * C'est la seule conversion dont un test de clic a besoin. Elle est calculée à
 * partir de la vue RÉELLEMENT affichée — et non de la vue du modèle, qui ne
 * suit pas les déplacements de l'utilisateur — pour qu'une tolérance de clic
 * reste constante à l'écran quel que soit le zoom.
 */
export function pixelScale(
  widthPixels: number,
  heightPixels: number,
  view: MathView
): PixelScale {
  return {
    x: widthPixels > 0 ? (view.xMax - view.xMin) / widthPixels : 1,
    y: heightPixels > 0 ? (view.yMax - view.yMin) / heightPixels : 1,
  };
}

/** Rayon de préhension, en pixels. Assez large pour un doigt, assez petit
 *  pour ne pas confondre deux points voisins. */
const PICK_RADIUS_PIXELS = 11;

/** Écart d'un point du monde à une droite, ou à un segment si borné. */
function offsetToLinear(line: LinearGeometry, world: WorldPoint): WorldPoint {
  const fromOrigin = sub(world, line.origin);
  const lengthSquared = dot(line.direction, line.direction);
  const t = line.bounded
    ? clamp01(dot(fromOrigin, line.direction) / lengthSquared)
    : dot(fromOrigin, line.direction) / lengthSquared;
  return sub(world, add(line.origin, scaleVec(line.direction, t)));
}

/** Distance d'un point du monde à une primitive, exprimée EN PIXELS. */
function pixelDistance(
  shape: Geometry,
  world: WorldPoint,
  scale: PixelScale
): number | null {
  switch (shape.kind) {
    case "point":
      return Math.hypot(
        (world.x - shape.at.x) / scale.x,
        (world.y - shape.at.y) / scale.y
      );
    case "linear": {
      const offset = offsetToLinear(shape, world);
      return Math.hypot(offset.x / scale.x, offset.y / scale.y);
    }
    case "circle": {
      const radial = Math.abs(length(sub(world, shape.center)) - shape.radius);
      // L'écart radial est perpendiculaire au cercle : sa longueur en pixels
      // dépend de l'orientation, que l'on ne connaît pas ici. On divise par
      // l'échelle la plus fine, ce qui rend le test légèrement plus permissif
      // sur un axe — un clic manqué serait plus gênant qu'un clic de trop.
      return radial / Math.min(scale.x, scale.y);
    }
    case "function": {
      const y = shape.evaluate(world.x);
      if (!Number.isFinite(y)) return null;
      // Écart vertical : exact sur une courbe peu pentue, approché sur une
      // courbe raide. Suffisant pour désigner une courbe du doigt.
      return Math.abs(world.y - y) / scale.y;
    }
  }
}

/**
 * L'objet visé par un clic, ou `null` si le clic tombe dans le vide.
 *
 * Le test est fait ICI, sur les primitives du modèle, et non par le renderer.
 * Deux raisons. D'abord la vérité est dans le modèle : interroger les éléments
 * graphiques obligerait à tenir une table de correspondance de plus, donc à
 * entretenir une seconde source. Ensuite le résultat est déterministe : à
 * coordonnées égales, l'objet désigné est toujours le même, quel que soit
 * l'ordre dans lequel la bibliothèque graphique a créé ses éléments.
 *
 * Un point l'emporte sur une courbe qui passe dessous, puis le plus proche
 * l'emporte. C'est ce qui permet de saisir l'extrémité d'un segment plutôt que
 * le segment lui-même.
 */
export function pickObject(
  objects: readonly MathObject[],
  shapes: ReadonlyMap<string, Geometry>,
  world: WorldPoint,
  scale: PixelScale
): string | null {
  let bestId: string | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const object of objects) {
    if (!object.visible || !RENDERED_KINDS.has(object.kind)) continue;
    const shape = shapes.get(object.id);
    if (!shape) continue;

    const distance = pixelDistance(shape, world, scale);
    if (distance === null || distance > PICK_RADIUS_PIXELS) continue;

    const rank = shape.kind === "point" ? 0 : 1;
    if (rank < bestRank || (rank === bestRank && distance < bestDistance)) {
      bestId = object.id;
      bestRank = rank;
      bestDistance = distance;
    }
  }

  return bestId;
}

// ── Résolution ────────────────────────────────────────────────────────────

export interface GeometryResolution {
  /** Primitive de chaque objet résolu, par identifiant. */
  shapes: Map<string, Geometry>;
  /** Objet géométriquement inexploitable → raison en français, affichable. */
  invalid: Map<string, string>;
}

/** Lit les deux points dont dépend un objet, ou explique pourquoi il ne peut
 *  pas. Une dépendance qui n'est pas un point est une erreur de définition,
 *  pas une panne : elle est donc dite, pas subie. */
function readEndpoints(
  object: MathObject,
  shapes: ReadonlyMap<string, Geometry>
): [WorldPoint, WorldPoint] | string {
  if (object.dependencies.length !== 2) {
    return `Cet objet attend exactement deux points (${object.dependencies.length} reçu${
      object.dependencies.length > 1 ? "s" : ""
    }).`;
  }

  const found: WorldPoint[] = [];
  for (const id of object.dependencies) {
    const shape = shapes.get(id);
    if (!shape) return `Le point « ${id} » n'est pas disponible.`;
    if (shape.kind !== "point") return `« ${id} » n'est pas un point.`;
    found.push(shape.at);
  }
  return [found[0], found[1]];
}

/**
 * Calcule la primitive de chaque objet, en UNE passe.
 *
 * La liste reçue est celle de `resolveObjectDependencies`, donc déjà ordonnée :
 * quand un objet est examiné, ses dépendances l'ont été avant lui. Il n'y a
 * donc ni récursion, ni tri, ni risque de boucle.
 *
 * Les objets déjà bloqués par le résolveur de dépendances sont SAUTÉS — leur
 * cause est connue et affichée ailleurs ; ils ne produisent ni primitive ni
 * second message. Un objet dont la géométrie est inexploitable (points
 * confondus, définition illisible, intersection disparue) est simplement
 * laissé SANS primitive et signalé dans `invalid` : le renderer l'ignore, le
 * reste de la construction continue de s'afficher.
 *
 * Cette fonction ne lève jamais, quelle que soit l'entrée.
 */
export function resolveGeometry(
  ordered: readonly MathObject[],
  blocked: ReadonlySet<string>
): GeometryResolution {
  const shapes = new Map<string, Geometry>();
  const invalid = new Map<string, string>();

  for (const object of ordered) {
    if (blocked.has(object.id)) continue;

    switch (object.kind) {
      case "function": {
        const source = object.definition.trim();
        // Ligne vide : une saisie en cours, pas une erreur. Rien à signaler.
        if (source === "") break;
        const compiled = compileFunction(source);
        if (compiled.status !== "ok") {
          invalid.set(object.id, compiled.message);
          break;
        }
        shapes.set(object.id, {
          kind: "function",
          source: compiled.source,
          evaluate: compiled.evaluate,
        });
        break;
      }

      case "point": {
        const parsed = parsePointDefinition(object.definition);
        if (!parsed.ok) {
          invalid.set(object.id, parsed.reason);
          break;
        }
        shapes.set(object.id, { kind: "point", at: parsed.point });
        break;
      }

      case "segment":
      case "line": {
        const endpoints = readEndpoints(object, shapes);
        if (typeof endpoints === "string") {
          invalid.set(object.id, endpoints);
          break;
        }
        const direction = sub(endpoints[1], endpoints[0]);
        if (scaledZero(length(direction), 1)) {
          invalid.set(
            object.id,
            "Les deux points sont confondus : la direction n'est pas définie."
          );
          break;
        }
        shapes.set(object.id, {
          kind: "linear",
          origin: endpoints[0],
          direction,
          bounded: object.kind === "segment",
        });
        break;
      }

      case "circle": {
        const endpoints = readEndpoints(object, shapes);
        if (typeof endpoints === "string") {
          invalid.set(object.id, endpoints);
          break;
        }
        const radius = length(sub(endpoints[1], endpoints[0]));
        if (scaledZero(radius, 1)) {
          invalid.set(
            object.id,
            "Le centre et le point du cercle sont confondus : le rayon est nul."
          );
          break;
        }
        shapes.set(object.id, { kind: "circle", center: endpoints[0], radius });
        break;
      }

      case "intersection": {
        if (object.dependencies.length !== 2) {
          invalid.set(
            object.id,
            `Une intersection attend exactement deux objets (${object.dependencies.length} reçu${
              object.dependencies.length > 1 ? "s" : ""
            }).`
          );
          break;
        }
        const first = shapes.get(object.dependencies[0]);
        const second = shapes.get(object.dependencies[1]);
        if (!first || !second) {
          invalid.set(object.id, "L'un des objets à couper n'est pas disponible.");
          break;
        }

        const result = intersectShapes(first, second);
        if (result.status !== "ok") {
          invalid.set(object.id, result.reason);
          break;
        }

        const branch = object.branch ?? 0;
        const at = result.points[branch];
        if (!at) {
          invalid.set(
            object.id,
            `Cette intersection n'existe plus : ${
              result.points.length
            } solution${result.points.length > 1 ? "s" : ""} au lieu de ${
              branch + 1
            }.`
          );
          break;
        }
        shapes.set(object.id, { kind: "point", at });
        break;
      }

      default:
        // Genre non géométrique (nombre) : aucune primitive, aucune erreur.
        break;
    }
  }

  return { shapes, invalid };
}

// ── Identité de rendu ─────────────────────────────────────────────────────

/**
 * Empreinte de la primitive RÉSOLUE.
 *
 * Le renderer ne peut pas se contenter de la définition d'un objet pour savoir
 * si son dessin est encore valide : un segment ne change pas de définition
 * quand on déplace son extrémité, il change de POSITION. Sans cette empreinte
 * dans la clé de rendu, déplacer un point ne redessinerait pas les objets qui
 * en dépendent.
 *
 * Les nombres y sont écrits tels quels : la conversion d'un double en chaîne
 * est exacte et réversible en JavaScript, il n'y a donc rien à arrondir.
 */
export function fingerprint(shape: Geometry): string {
  switch (shape.kind) {
    case "function":
      return `f:${shape.source}`;
    case "point":
      return `p:${shape.at.x}:${shape.at.y}`;
    case "linear":
      return `l:${shape.bounded ? "segment" : "droite"}:${shape.origin.x}:${
        shape.origin.y
      }:${shape.direction.x}:${shape.direction.y}`;
    case "circle":
      return `c:${shape.center.x}:${shape.center.y}:${shape.radius}`;
  }
}

// ── Description lisible ───────────────────────────────────────────────────

export function objectName(object: MathObject): string {
  return object.label ?? object.id;
}

/**
 * Phrase décrivant un objet, pour la liste et le panneau de propriétés.
 *
 * Les objets DÉRIVÉS n'ont pas de définition stockée, et c'est délibéré : leur
 * définition, ce sont leurs dépendances. Écrire « A, B » dans un champ texte
 * ferait vivre une seconde copie du lien, qui se périmerait dès que
 * l'utilisateur renomme A. La phrase est donc CALCULÉE à l'affichage, à partir
 * des identifiants — jamais conservée.
 */
export function describeObject(
  object: MathObject,
  byId: ReadonlyMap<string, MathObject>
): string {
  const names = object.dependencies.map((id) => {
    const dependency = byId.get(id);
    return dependency ? objectName(dependency) : id;
  });
  const definition = object.definition.trim();

  switch (object.kind) {
    case "function":
      return definition === "" ? "—" : definition;
    case "number":
      return definition === "" ? "—" : definition;
    case "point":
      return definition === "" ? "—" : `(${definition})`;
    case "segment":
      return names.length === 2 ? `[${names[0]}${names[1]}]` : "segment incomplet";
    case "line":
      return names.length === 2 ? `(${names[0]}${names[1]})` : "droite incomplète";
    case "circle":
      return names.length === 2
        ? `cercle de centre ${names[0]} passant par ${names[1]}`
        : "cercle incomplet";
    case "intersection": {
      if (names.length !== 2) return "intersection incomplète";
      const branch = object.branch ?? 0;
      const base = `intersection de ${names[0]} et ${names[1]}`;
      // Les solutions au-delà de la première sont numérotées : sans cela, deux
      // intersections des mêmes objets seraient indiscernables dans la liste.
      return branch === 0 ? base : `${base} — solution ${branch + 1}`;
    }
  }
}

// ── Fabriques d'objets ────────────────────────────────────────────────────

/**
 * Taille par défaut d'un point, en pixels. Elle existe ici et non dans le
 * renderer : c'est une propriété de l'objet, éditable dans le panneau, et le
 * renderer ne fait que la lire.
 */
export const DEFAULT_POINT_SIZE = 4;

/**
 * Un même lot d'objets doit être cohérent avec lui-même.
 *
 * Créer un segment, c'est créer trois objets d'un coup (deux points et le
 * segment). Si chaque objet lisait la seule construction pour choisir son nom
 * et sa couleur, les trois porteraient le même — les objets déjà construits
 * dans le lot doivent donc compter comme pris. C'est ce que fait ce
 * constructeur : il alloue les identifiants d'avance et garde le lot sous la
 * main jusqu'à l'ajout, qui sera atomique.
 */
class Batch {
  private readonly objects: MathObject[] = [];
  private nextId: number;

  constructor(private readonly construction: MathConstruction) {
    this.nextId = construction.nextId;
  }

  /** Les objets déjà là, PUIS ceux construits dans ce lot. */
  private pool(): MathObject[] {
    return [...this.construction.objects, ...this.objects];
  }

  private reserve(kind: MathObjectKind): string {
    const id = `${kind}-${this.nextId}`;
    this.nextId += 1;
    return id;
  }

  addFreePoint(world: WorldPoint): MathObject {
    const pool = this.pool();
    const at = {
      x: roundToClickPrecision(world.x),
      y: roundToClickPrecision(world.y),
    };
    return this.push({
      id: this.reserve("point"),
      kind: "point",
      label: allocateLabel(pool, "point"),
      definition: formatPointDefinition(at),
      dependencies: [],
      style: {
        color: allocateColor(pool),
        width: 2,
        pointSize: DEFAULT_POINT_SIZE,
      },
      visible: true,
    });
  }

  addDerived(kind: MathObjectKind, dependencies: readonly string[]): MathObject {
    const pool = this.pool();
    return this.push({
      id: this.reserve(kind),
      kind,
      label: allocateLabel(pool, kind),
      // Vide, et non une phrase : la description d'un objet dérivé se CALCULE
      // à partir de ses dépendances (voir `describeObject`).
      definition: "",
      dependencies: [...dependencies],
      style: { color: allocateColor(pool), width: 2 },
      visible: true,
    });
  }

  addIntersection(dependencies: readonly string[], branch: number): MathObject {
    const created = this.addDerived("intersection", dependencies);
    created.branch = branch;
    return created;
  }

  private push(object: MathObject): MathObject {
    this.objects.push(object);
    return object;
  }

  done(): MathObject[] {
    return this.objects;
  }
}

/** Un point libre, posé à l'endroit cliqué. */
export function pointObject(
  construction: MathConstruction,
  world: WorldPoint
): MathObject[] {
  const batch = new Batch(construction);
  batch.addFreePoint(world);
  return batch.done();
}

/**
 * Deuxième clic d'un segment, d'une droite ou d'un cercle : le second point
 * est créé, puis l'objet qui l'utilise.
 *
 * Le point est créé AVANT l'objet qui s'y appuie, dans le même ajout : c'est
 * ce qui garantit qu'il n'existe aucun instant où l'objet dépendrait d'un
 * point absent — donc aucun rendu d'une construction invalide.
 */
function extendWith(
  kind: "segment" | "line" | "circle",
  construction: MathConstruction,
  firstId: string,
  world: WorldPoint
): MathObject[] {
  const batch = new Batch(construction);
  const second = batch.addFreePoint(world);
  batch.addDerived(kind, [firstId, second.id]);
  return batch.done();
}

export function segmentToWorld(
  construction: MathConstruction,
  firstId: string,
  world: WorldPoint
): MathObject[] {
  return extendWith("segment", construction, firstId, world);
}

export function lineToWorld(
  construction: MathConstruction,
  firstId: string,
  world: WorldPoint
): MathObject[] {
  return extendWith("line", construction, firstId, world);
}

export function circleToWorld(
  construction: MathConstruction,
  firstId: string,
  world: WorldPoint
): MathObject[] {
  return extendWith("circle", construction, firstId, world);
}

/** Variante où le second point EXISTE déjà : il est réutilisé, pas dupliqué. */
function between(
  kind: "segment" | "line" | "circle",
  construction: MathConstruction,
  firstId: string,
  secondId: string
): MathObject[] {
  const batch = new Batch(construction);
  batch.addDerived(kind, [firstId, secondId]);
  return batch.done();
}

export function segmentBetween(
  construction: MathConstruction,
  firstId: string,
  secondId: string
): MathObject[] {
  return between("segment", construction, firstId, secondId);
}

export function lineBetween(
  construction: MathConstruction,
  firstId: string,
  secondId: string
): MathObject[] {
  return between("line", construction, firstId, secondId);
}

export function circleBetween(
  construction: MathConstruction,
  firstId: string,
  secondId: string
): MathObject[] {
  return between("circle", construction, firstId, secondId);
}

/**
 * Les objets d'intersection, UN PAR SOLUTION.
 *
 * Un objet = un point. Deux solutions font donc deux objets, sélectionnables
 * et supprimables séparément — au lieu d'un objet à deux têtes que rien ne
 * saurait sélectionner ni effacer sans emporter l'autre. `branch` dit laquelle
 * des solutions, dans l'ordre canonique calculé ici même : l'identité d'une
 * intersection ne dépend donc jamais de l'ordre dans lequel une bibliothèque
 * graphique aurait rendu ses résultats.
 *
 * Les points sont fournis par l'appelant, qui a déjà dû les calculer pour
 * savoir s'il y avait lieu de créer quelque chose.
 */
export function intersectionObjects(
  construction: MathConstruction,
  firstId: string,
  secondId: string,
  points: readonly WorldPoint[]
): MathObject[] {
  const batch = new Batch(construction);
  points.forEach((_, branch) => {
    batch.addIntersection([firstId, secondId], branch);
  });
  return batch.done();
}
