/**
 * Modèle objet de l'espace mathématique — la SOURCE DE VÉRITÉ.
 *
 * CE QUI CHANGE, ET POURQUOI
 *
 * Jusqu'ici l'état mathématique vivait dans le rendu : `MathFunctions` gardait
 * ses lignes de fonctions dans un `useState` local, et `MathGraph` recevait des
 * courbes déjà compilées. Le graphe était donc, de fait, le propriétaire de la
 * vérité — le détruire perdait tout.
 *
 * Ici, l'état devient une DONNÉE : une `MathConstruction` sérialisable, que le
 * rendu ne fait que projeter. JSXGraph redevient ce qu'il aurait toujours dû
 * être — un renderer jetable. Détruire le plateau et le reconstruire à partir
 * de la construction ne perd rien, parce qu'il n'y avait rien à perdre.
 *
 * CE MODULE EST PUR : aucune dépendance à React, aucun effet de bord, aucune
 * horloge, aucun aléatoire. Toutes les opérations renvoient une NOUVELLE
 * construction plutôt que de muter celle qu'on leur passe.
 *
 * Le moteur de calcul (`parser`, `numeric`, `exact`…) n'est PAS touché : il
 * reste la seule autorité sur ce qu'une expression vaut. Ce module ne fait que
 * décrire QUELS objets existent, pas ce qu'ils valent.
 */

// ── Types d'objets ────────────────────────────────────────────────────────

/**
 * Les genres d'objets que le modèle sait DÉCRIRE.
 *
 * Tous ne sont pas encore RENDUS : `function` l'est, les autres sont décrits
 * ici pour que le modèle, le résolveur de dépendances et la liste d'objets
 * n'aient pas à être réécrits quand C3 ajoutera leur rendu. Un genre décrit
 * mais non rendu est signalé comme tel dans l'interface — jamais ignoré en
 * silence.
 */
export type MathObjectKind =
  | "function"
  | "point"
  | "segment"
  | "line"
  | "circle"
  | "intersection"
  | "number";

/** L'ordre est celui d'affichage dans les listes. */
export const MATH_OBJECT_KINDS: readonly MathObjectKind[] = [
  "function",
  "point",
  "segment",
  "line",
  "circle",
  "intersection",
  "number",
] as const;

const KNOWN_KINDS: ReadonlySet<string> = new Set<string>(MATH_OBJECT_KINDS);

export const MATH_OBJECT_KIND_LABELS: Readonly<Record<MathObjectKind, string>> = {
  function: "Fonction",
  point: "Point",
  segment: "Segment",
  line: "Droite",
  circle: "Cercle",
  intersection: "Intersection",
  number: "Nombre",
};

/**
 * Les genres que le renderer sait réellement dessiner AUJOURD'HUI.
 *
 * Cette liste vit dans le modèle, et non dans le renderer, pour que la liste
 * d'objets puisse annoncer « décrit, pas encore tracé » sans interroger
 * JSXGraph. C3 y a ajouté la géométrie ; `number` reste volontairement
 * dehors — voir le rapport C3.
 */
export const RENDERED_KINDS: ReadonlySet<MathObjectKind> = new Set<MathObjectKind>([
  "function",
  "point",
  "segment",
  "line",
  "circle",
  "intersection",
]);

/**
 * Apparence d'un objet. Tous les champs sont optionnels : un objet créé sans
 * style doit rester valide, et le renderer applique ses propres valeurs par
 * défaut.
 *
 * La VISIBILITÉ n'est volontairement PAS ici. La proposition initiale la
 * rangeait à la fois dans `style.visible` et dans `MathObject.visible` : deux
 * champs pour un même fait, donc deux vérités à garder d'accord. Elle vit
 * uniquement dans `MathObject.visible`.
 */
export interface MathObjectStyle {
  color?: string;
  /** Épaisseur du trait, en pixels écran du renderer. */
  width?: number;
  /** Rayon d'un point, quand le genre en a un. */
  pointSize?: number;
}

/**
 * Couleur de repli, quand un objet n'en porte aucune.
 *
 * Elle vit dans le modèle — et non dans le renderer — parce que deux endroits
 * l'affichent : le tracé et la pastille de la liste d'objets. Deux constantes
 * séparées finiraient par diverger, et la pastille mentirait sur la couleur
 * réellement tracée.
 */
export const DEFAULT_OBJECT_COLOR = "#3b82f6";

/**
 * Palette d'attribution automatique.
 *
 * Les quatre premières teintes sont EXACTEMENT celles des courbes avant C3 :
 * une fonction créée aujourd'hui reçoit donc la couleur qu'elle aurait reçue
 * hier. C3 n'a fait qu'allonger la liste pour que les objets géométriques, qui
 * peuvent être plus nombreux que quatre, restent distinguables.
 */
export const OBJECT_COLORS = [
  "#f5a900",
  "#3b82f6",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#64748b",
] as const;

/**
 * Premières lettres proposées, par genre. Les points prennent des majuscules,
 * le reste des minuscules : « A » (un point) et « a » (un segment) ne se
 * confondent pas dans la liste.
 */
const POINT_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const LABEL_BASES: Readonly<Record<MathObjectKind, readonly string[]>> = {
  function: ["f", "g", "h", "k"],
  point: POINT_LABELS,
  segment: ["s"],
  line: ["d"],
  circle: ["c"],
  intersection: ["I"],
  number: ["n"],
};

/**
 * Alloue un nom libre pour un genre donné.
 *
 * Deux objets homonymes seraient indiscernables dans la liste, dans la légende
 * du graphe et dans les définitions qui citent leurs parents — c'est pourquoi
 * l'allocation est centralisée ici plutôt que laissée à chaque outil.
 */
export function allocateLabel(
  objects: readonly MathObject[],
  kind: MathObjectKind
): string {
  const bases = LABEL_BASES[kind];
  const taken = new Set(objects.map((object) => object.label));
  for (const base of bases) {
    if (!taken.has(base)) return base;
  }
  // Au-delà de la première série (« A »…« Z »), on suffixe : « A2 », « B2 »…
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    for (const base of bases) {
      const candidate = `${base}${suffix}`;
      if (!taken.has(candidate)) return candidate;
    }
  }
  return `${bases[0]}${objects.length}`;
}

/** Première couleur libre. Au-delà de la palette, on recommence au début :
 *  mieux vaut une teinte réutilisée qu'un objet sans couleur. */
export function allocateColor(objects: readonly MathObject[]): string {
  const taken = new Set(objects.map((object) => object.style.color));
  return (
    OBJECT_COLORS.find((color) => !taken.has(color)) ??
    OBJECT_COLORS[objects.length % OBJECT_COLORS.length]
  );
}

export interface MathObject {
  /** Identifiant STABLE. Voir `makeObjectId` : jamais l'index du tableau. */
  id: string;
  kind: MathObjectKind;
  /** Nom affiché (« f », « A »…). Optionnel : un objet peut rester anonyme. */
  label?: string;
  /**
   * Définition source, dans la syntaxe du moteur existant.
   *
   * `"x^2 + 1"` pour une fonction, `"pi, 2"` pour un point, `"A, B"` pour un
   * segment. C'est le moteur (`compileFunction`, `evaluateConstant`) qui
   * l'interprète — ce module ne l'analyse jamais lui-même.
   */
  definition: string;
  /** Identifiants des objets dont celui-ci dépend. `segment(A,B)` → `["point-A","point-B"]`. */
  dependencies: string[];
  /**
   * Indice de solution, pour les genres qui en produisent PLUSIEURS.
   *
   * Une droite et un cercle se coupent en deux points : ce sont deux objets
   * distincts, sélectionnables et supprimables séparément. Ce champ dit lequel
   * des deux. L'ordre des solutions est CANONIQUE et calculé par
   * `geometry.ts` (croissant en x, puis en y) — il ne dépend donc jamais de
   * l'ordre dans lequel une bibliothèque graphique aurait renvoyé ses
   * résultats. C'est ce qui rend `branch: 1` stable d'un rendu à l'autre.
   *
   * Absent ailleurs. Ajout C3, purement optionnel : un document écrit par C2
   * reste lisible, et vaut `branch: 0`.
   */
  branch?: number;
  style: MathObjectStyle;
  visible: boolean;
}

// ── Vue et sélection ──────────────────────────────────────────────────────

/** Fenêtre mathématique affichée. `xMin < xMax`, `yMin < yMax`. */
export interface MathView {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface MathSelection {
  selectedObjectId: string | null;
}

/** Cadrage d'origine — identique à celui que le graphe utilisait déjà. */
export const DEFAULT_VIEW: MathView = { xMin: -6, xMax: 6, yMin: -4, yMax: 4 };

// ── Construction ──────────────────────────────────────────────────────────

/**
 * Version du FORMAT sérialisé. Elle existe pour permettre des migrations :
 * quand la forme changera, on saura quoi convertir. Incrémenter à chaque
 * changement incompatible.
 */
export const CONSTRUCTION_VERSION = 1;

export interface MathConstruction {
  version: number;
  objects: MathObject[];
  view: MathView;
  selection: MathSelection;
  /**
   * Compteur monotone d'identifiants — voir `makeObjectId`.
   *
   * Il ne DÉCROÎT jamais : c'est ce qui garantit qu'un identifiant libéré par
   * une suppression n'est pas réattribué. Sans lui, supprimer `function-2`
   * puis ajouter une fonction redonnerait `function-2`, et un renderer qui
   * n'aurait pas encore retiré l'ancien élément le confondrait avec le
   * nouveau.
   */
  nextId: number;
}

export function createConstruction(view: Partial<MathView> = {}): MathConstruction {
  return {
    version: CONSTRUCTION_VERSION,
    objects: [],
    view: { ...DEFAULT_VIEW, ...view },
    selection: { selectedObjectId: null },
    nextId: 1,
  };
}

// ── Identifiants ──────────────────────────────────────────────────────────

/**
 * Construction d'OUVERTURE de l'espace mathématique : une fonction d'exemple.
 *
 * Elle est créée ici, et non dans un composant, pour deux raisons. D'abord
 * parce que c'est une donnée : elle doit survivre à la destruction du
 * renderer, comme le reste. Ensuite parce qu'un composant qui « sème » un
 * objet au montage écrirait dans le modèle pendant un effet — le mode strict
 * de React le ferait deux fois, et il faudrait une garde pour rien.
 *
 * La couleur est celle qu'avait la première courbe avant cette refonte : le
 * panneau s'ouvre donc exactement sur ce qu'il affichait déjà.
 *
 * La relecture d'un document abîmé, elle, repart d'une construction VIDE (voir
 * `deserializeConstruction`) : ressusciter un `x^2` que l'utilisateur n'a pas
 * écrit serait inventer du contenu.
 */
export function createInitialConstruction(): MathConstruction {
  const base = createConstruction();
  return addObject(base, {
    id: makeObjectId(base, "function"),
    kind: "function",
    label: "f",
    definition: "x^2",
    dependencies: [],
    style: { color: "#f5a900", width: 2 },
    visible: true,
  });
}

/** Suffixe numérique d'un identifiant (`"function-12"` → `12`), sinon 0. */
function idSuffix(id: string): number {
  const match = /-(\d+)$/.exec(id);
  if (!match) return 0;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Alloue le prochain identifiant pour un genre donné — `function-1`,
 * `point-2`…
 *
 * L'identifiant est UNIQUE au sens fort : il ne désigne jamais deux objets, et
 * le compteur ne revient pas en arrière. Appeler `makeObjectId` deux fois de
 * suite SANS `addObject` entre les deux renvoie le même identifiant — allouer
 * puis ajouter immédiatement.
 */
export function makeObjectId(construction: MathConstruction, kind: MathObjectKind): string {
  return `${kind}-${construction.nextId}`;
}

/**
 * Alloue une SUITE d'identifiants, dans l'ordre demandé.
 *
 * Créer un segment, c'est créer trois objets d'un coup (deux points et le
 * segment). Les allouer un par un depuis la construction COURANTE donnerait
 * deux fois le même identifiant, puisque `nextId` n'avance qu'à l'ajout. On
 * réserve donc toute la suite d'abord, puis on ajoute — sans rien intercaler.
 */
export function makeObjectIdSequence(
  construction: MathConstruction,
  kinds: readonly MathObjectKind[]
): string[] {
  return kinds.map((kind, index) => `${kind}-${construction.nextId + index}`);
}

// ── Opérations ────────────────────────────────────────────────────────────
// Toutes PURES : elles renvoient une nouvelle construction et laissent
// l'ancienne intacte. Aucune ne lève.

export function getObjectById(
  construction: MathConstruction,
  id: string
): MathObject | undefined {
  return construction.objects.find((object) => object.id === id);
}

export function hasObject(construction: MathConstruction, id: string): boolean {
  return construction.objects.some((object) => object.id === id);
}

/**
 * Ajoute un objet. Un identifiant déjà pris est REFUSÉ (la construction est
 * renvoyée telle quelle) plutôt que de créer un doublon : deux objets de même
 * identifiant rendraient le renderer indéterministe.
 */
export function addObject(
  construction: MathConstruction,
  object: MathObject
): MathConstruction {
  if (hasObject(construction, object.id)) return construction;
  return {
    ...construction,
    objects: [...construction.objects, object],
    // Le compteur ne recule jamais : un objet importé portant un suffixe élevé
    // décale l'allocation suivante au-delà, au lieu de la chevaucher.
    nextId: Math.max(construction.nextId, idSuffix(object.id) + 1),
  };
}

/**
 * Ajoute plusieurs objets en une seule opération.
 *
 * Un ajout multiple doit être ATOMIQUE : il ne doit pas exister d'instant où le
 * segment est là mais pas ses extrémités, sinon le renderer dessinerait une
 * construction invalide pendant un rendu. `nextId` n'avance qu'une fois, après
 * avoir pris en compte TOUS les suffixes ajoutés.
 *
 * Un objet dont l'identifiant est déjà pris est écarté — jamais dupliqué.
 *
 * Les objets sont complets (et non des brouillons) : c'est ce qui permet à un
 * outil qui en crée plusieurs d'un coup d'allouer le nom du deuxième en tenant
 * compte du premier, sans inventer un type intermédiaire.
 */
export function addObjects(
  construction: MathConstruction,
  objects: readonly MathObject[]
): MathConstruction {
  if (objects.length === 0) return construction;

  const taken = new Set(construction.objects.map((object) => object.id));
  const added: MathObject[] = [];

  for (const object of objects) {
    if (taken.has(object.id)) continue;
    taken.add(object.id);
    added.push(object);
  }

  if (added.length === 0) return construction;

  let nextId = construction.nextId;
  for (const object of added) nextId = Math.max(nextId, idSuffix(object.id) + 1);

  return { ...construction, objects: [...construction.objects, ...added], nextId };
}

export function updateObject(
  construction: MathConstruction,
  id: string,
  patch: Partial<Omit<MathObject, "id" | "kind">>
): MathConstruction {
  const current = getObjectById(construction, id);
  if (!current) return construction;
  return {
    ...construction,
    objects: construction.objects.map((object) =>
      object.id === id ? { ...object, ...patch } : object
    ),
  };
}

/** Fusionne le style au lieu de le remplacer — un patch de couleur ne doit pas
 *  effacer l'épaisseur déjà choisie. */
export function updateObjectStyle(
  construction: MathConstruction,
  id: string,
  patch: MathObjectStyle
): MathConstruction {
  const current = getObjectById(construction, id);
  if (!current) return construction;
  return updateObject(construction, id, { style: { ...current.style, ...patch } });
}

export function setObjectVisibility(
  construction: MathConstruction,
  id: string,
  visible: boolean
): MathConstruction {
  const current = getObjectById(construction, id);
  if (!current || current.visible === visible) return construction;
  return updateObject(construction, id, { visible });
}

export function selectObject(
  construction: MathConstruction,
  id: string | null
): MathConstruction {
  // Re-sélectionner le même objet renvoie la MÊME construction : sans cela le
  // panneau de propriétés se re-rendrait à chaque clic inutile.
  if (construction.selection.selectedObjectId === id) return construction;
  return { ...construction, selection: { selectedObjectId: id } };
}

/**
 * Bascule la sélection : un objet déjà sélectionné est désélectionné.
 *
 * C'est le geste qu'attend une liste : recliquer sur la ligne courante la
 * relâche, sans avoir à chercher une « croix » ailleurs.
 */
export function toggleObjectSelection(
  construction: MathConstruction,
  id: string
): MathConstruction {
  return selectObject(
    construction,
    construction.selection.selectedObjectId === id ? null : id
  );
}

export function setView(
  construction: MathConstruction,
  view: Partial<MathView>
): MathConstruction {
  const next: MathView = { ...construction.view, ...view };
  const unchanged =
    next.xMin === construction.view.xMin &&
    next.xMax === construction.view.xMax &&
    next.yMin === construction.view.yMin &&
    next.yMax === construction.view.yMax;
  return unchanged ? construction : { ...construction, view: next };
}

/**
 * Identifiants des objets qui dépendent DIRECTEMENT ou NON de `id`, sans
 * jamais revenir sur ses pas.
 *
 * Le parcours est itératif et marque chaque identifiant visité : un cycle de
 * dépendances fait donc terminer la boucle, il ne la fait pas tourner sans
 * fin.
 */
export function collectDependentIds(
  objects: readonly MathObject[],
  id: string
): string[] {
  const found = new Set<string>();
  let frontier: string[] = [id];

  while (frontier.length > 0) {
    const next: string[] = [];
    for (const current of frontier) {
      for (const object of objects) {
        if (object.id === id || found.has(object.id)) continue;
        if (object.dependencies.includes(current)) {
          found.add(object.id);
          next.push(object.id);
        }
      }
    }
    frontier = next;
  }

  return [...found];
}

/**
 * Supprime un objet ET tout ce qui dépend de lui.
 *
 * Supprimer un point dont un segment dépend laisserait sinon une construction
 * invalide en permanence. La suppression est donc en CASCADE — comme le fait
 * n'importe quel logiciel de géométrie dynamique — et la sélection est
 * relâchée si elle désignait l'un des objets emportés.
 */
export function removeObject(
  construction: MathConstruction,
  id: string
): MathConstruction {
  if (!hasObject(construction, id)) return construction;

  const doomed = new Set<string>([id, ...collectDependentIds(construction.objects, id)]);
  const selected = construction.selection.selectedObjectId;

  return {
    ...construction,
    objects: construction.objects.filter((object) => !doomed.has(object.id)),
    selection:
      selected !== null && doomed.has(selected)
        ? { selectedObjectId: null }
        : construction.selection,
  };
}

// ── Dépendances ───────────────────────────────────────────────────────────

export type DependencyIssueKind =
  /** L'objet référence un identifiant qui n'existe pas. */
  | "missing"
  /** L'objet participe à un cycle de dépendances. */
  | "cycle";

export interface DependencyIssue {
  /** Premier objet concerné — le point d'entrée pour l'afficher. */
  objectId: string;
  kind: DependencyIssueKind;
  /** Identifiants manquants, ou membres du cycle. */
  references: string[];
}

export interface ResolvedConstruction {
  /**
   * Tous les objets, réordonnés pour que chaque objet vienne APRÈS ses
   * dépendances. C'est l'ordre de rendu : `A`, `B`, puis `segment(A,B)`.
   */
  ordered: MathObject[];
  /** Causes racines — un objet bloqué par ricochet n'y figure pas. */
  issues: DependencyIssue[];
  /**
   * Objets qui ne peuvent pas être rendus : eux-mêmes en cause, ou dépendant
   * (directement ou non) d'un objet en cause. Le renderer les SAUTE.
   */
  blocked: Set<string>;
}

/**
 * Ordonne les objets selon leurs dépendances et signale ce qui ne peut pas
 * être rendu.
 *
 * Tri topologique de Kahn, en BOUCLE et non en récursion : une chaîne de
 * dépendances très profonde ne doit pas faire déborder la pile d'appels.
 *
 * Trois cas sont distingués, et aucun ne fait planter :
 *
 *  - pas de dépendance → ordre d'entrée conservé ;
 *  - dépendance valide → l'objet passe après elle ;
 *  - dépendance inexistante → signalée (`missing`), l'objet et ses dépendants
 *    sont `blocked`, le reste de la construction est rendu normalement ;
 *  - cycle → détecté en fin de tri (ce qui n'est pas sorti de la file), les
 *    objets du cycle et leurs dépendants sont `blocked`. La boucle termine
 *    toujours : chaque objet n'entre qu'une fois dans la file.
 */
export function resolveObjectDependencies(
  objects: readonly MathObject[]
): ResolvedConstruction {
  const byId = new Map<string, MathObject>();
  for (const object of objects) byId.set(object.id, object);

  const issues: DependencyIssue[] = [];
  const blocked = new Set<string>();

  // 1) Dépendances qui ne désignent rien.
  for (const object of objects) {
    const missing = object.dependencies.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      blocked.add(object.id);
      issues.push({ objectId: object.id, kind: "missing", references: missing });
    }
  }

  // 2) Blocage par ricochet : dépendre d'un objet bloqué, c'est l'être aussi.
  //    La propagation s'arrête d'elle-même — `blocked` ne fait que grandir.
  let spread = blocked.size > 0;
  while (spread) {
    spread = false;
    for (const object of objects) {
      if (blocked.has(object.id)) continue;
      if (object.dependencies.some((id) => blocked.has(id))) {
        blocked.add(object.id);
        spread = true;
      }
    }
  }

  // 3) Tri topologique sur les seules arêtes valides.
  const position = new Map<string, number>();
  objects.forEach((object, index) => position.set(object.id, index));

  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const object of objects) {
    let degree = 0;
    for (const id of object.dependencies) {
      if (!byId.has(id)) continue; // déjà signalée
      degree += 1;
      const list = dependents.get(id);
      if (list) list.push(object.id);
      else dependents.set(id, [object.id]);
    }
    // Une auto-dépendance donne un degré ≥ 1 : l'objet ne sort jamais de la
    // file et sera donc vu comme un cycle à l'étape 4, sans traitement spécial.
    indegree.set(object.id, degree);
  }

  // File d'attente triée par ordre d'entrée : à dépendances égales, l'ordre
  // d'origine est conservé, donc le rendu est déterministe.
  const ready: number[] = [];
  for (let index = 0; index < objects.length; index++) {
    if (indegree.get(objects[index].id) === 0) ready.push(index);
  }

  const ordered: MathObject[] = [];
  const settled = new Set<string>();

  while (ready.length > 0) {
    const index = ready.shift() as number;
    const object = objects[index];
    ordered.push(object);
    settled.add(object.id);

    for (const dependentId of dependents.get(object.id) ?? []) {
      const degree = (indegree.get(dependentId) ?? 0) - 1;
      indegree.set(dependentId, degree);
      if (degree !== 0) continue;
      // Insertion ordonnée (recherche dichotomique) plutôt qu'un `push` :
      // c'est ce qui garde l'ordre d'entrée stable.
      const at = position.get(dependentId) as number;
      let low = 0;
      let high = ready.length;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (ready[mid] < at) low = mid + 1;
        else high = mid;
      }
      ready.splice(low, 0, at);
    }
  }

  // 4) Ce qui n'est pas sorti appartient à un cycle.
  const remaining = objects.filter((object) => !settled.has(object.id));
  if (remaining.length > 0) {
    for (const object of remaining) blocked.add(object.id);
    issues.push({
      objectId: remaining[0].id,
      kind: "cycle",
      references: remaining.map((object) => object.id),
    });
  }

  return { ordered, issues, blocked };
}

// ── Sérialisation ─────────────────────────────────────────────────────────

/**
 * La construction est déjà une donnée JSON : la sérialisation est donc une
 * simple écriture, sans transformation. La fonction existe pour que le jour où
 * le format divergera de la structure en mémoire, il n'y ait qu'un endroit à
 * changer.
 */
export function serializeConstruction(construction: MathConstruction): string {
  return JSON.stringify(construction);
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readStyle(value: unknown): MathObjectStyle {
  if (typeof value !== "object" || value === null) return {};
  const raw = value as Record<string, unknown>;
  const style: MathObjectStyle = {};
  if (typeof raw.color === "string") style.color = raw.color;
  if (typeof raw.width === "number" && Number.isFinite(raw.width)) style.width = raw.width;
  if (typeof raw.pointSize === "number" && Number.isFinite(raw.pointSize)) {
    style.pointSize = raw.pointSize;
  }
  return style;
}

/** Un objet lisible, ou `null` si l'entrée est inexploitable. */
function readObject(value: unknown): MathObject | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw.id !== "string" || raw.id.trim() === "") return null;
  if (typeof raw.kind !== "string" || !KNOWN_KINDS.has(raw.kind)) return null;
  if (typeof raw.definition !== "string") return null;

  return {
    id: raw.id,
    kind: raw.kind as MathObjectKind,
    label: typeof raw.label === "string" ? raw.label : undefined,
    definition: raw.definition,
    dependencies: Array.isArray(raw.dependencies)
      ? raw.dependencies.filter((id): id is string => typeof id === "string")
      : [],
    // Un indice de solution absent vaut 0 : un document écrit par C2 n'en
    // porte aucun, et sa première solution est la bonne.
    branch:
      typeof raw.branch === "number" && Number.isFinite(raw.branch) && raw.branch >= 0
        ? Math.floor(raw.branch)
        : undefined,
    style: readStyle(raw.style),
    // Absence de `visible` = visible : un document écrit avant ce champ ne doit
    // pas devenir invisible d'un coup.
    visible: raw.visible !== false,
  };
}

/**
 * Relit une construction sérialisée.
 *
 * LECTURE TOLÉRANTE, comme celle de l'historique : une entrée illisible est
 * ÉCARTÉE, jamais propagée sous forme d'exception. Une sauvegarde abîmée doit
 * dégrader l'affichage, pas empêcher l'ouverture de la page.
 *
 * Ce qui est réparé plutôt que refusé :
 *  - `objects` absent ou non tableau → construction vide ;
 *  - objet sans identifiant, sans genre connu ou sans définition → écarté ;
 *  - identifiant en double → le premier gagne ;
 *  - `view` non finie ou inversée → cadrage par défaut ;
 *  - `selection` qui ne désigne aucun objet → sélection vide ;
 *  - `nextId` absent ou inférieur au plus grand suffixe utilisé → recalculé,
 *    pour qu'aucun identifiant ne puisse être réattribué.
 *
 * `version` est conservée telle quelle quand elle est numérique : c'est ce qui
 * permettra d'écrire des migrations ciblées plus tard. Aucune migration n'est
 * appliquée aujourd'hui — le format n'a qu'une version.
 */
export function deserializeConstruction(raw: unknown): MathConstruction {
  let value: unknown = raw;

  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return createConstruction();
    }
  }

  if (typeof value !== "object" || value === null) return createConstruction();
  const source = value as Record<string, unknown>;

  const objects: MathObject[] = [];
  const seen = new Set<string>();
  if (Array.isArray(source.objects)) {
    for (const entry of source.objects) {
      const object = readObject(entry);
      if (!object || seen.has(object.id)) continue;
      seen.add(object.id);
      objects.push(object);
    }
  }

  const viewRaw =
    typeof source.view === "object" && source.view !== null
      ? (source.view as Record<string, unknown>)
      : {};
  const view: MathView = {
    xMin: readFiniteNumber(viewRaw.xMin, DEFAULT_VIEW.xMin),
    xMax: readFiniteNumber(viewRaw.xMax, DEFAULT_VIEW.xMax),
    yMin: readFiniteNumber(viewRaw.yMin, DEFAULT_VIEW.yMin),
    yMax: readFiniteNumber(viewRaw.yMax, DEFAULT_VIEW.yMax),
  };
  // Un cadrage vide ou retourné n'afficherait rien : on repart du défaut.
  const viewIsUsable = view.xMin < view.xMax && view.yMin < view.yMax;

  const selectionRaw =
    typeof source.selection === "object" && source.selection !== null
      ? (source.selection as Record<string, unknown>)
      : {};
  const selected = selectionRaw.selectedObjectId;
  const selection: MathSelection = {
    selectedObjectId:
      typeof selected === "string" && seen.has(selected) ? selected : null,
  };

  let nextId = 1;
  for (const object of objects) nextId = Math.max(nextId, idSuffix(object.id) + 1);

  return {
    version: readFiniteNumber(source.version, CONSTRUCTION_VERSION),
    objects,
    view: viewIsUsable ? view : { ...DEFAULT_VIEW },
    selection,
    nextId,
  };
}
