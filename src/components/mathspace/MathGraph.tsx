import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as JXG from "jsxgraph";
import { Maximize2 } from "lucide-react";
import {
  DEFAULT_OBJECT_COLOR,
  DEFAULT_VIEW,
  RENDERED_KINDS,
  type MathConstruction,
  type MathObject,
  type MathView,
  type ResolvedConstruction,
} from "../../lib/math/construction";
import {
  DEFAULT_POINT_SIZE,
  circleAnchors,
  fingerprint,
  linearAnchors,
  pickObject,
  pixelScale,
  type Geometry,
  type GeometryResolution,
  type PixelScale,
  type WorldPoint,
} from "../../lib/math/geometry";

/**
 * Graphe interactif — un PROJECTEUR du modèle, pas son propriétaire.
 *
 * `jsxgraph` était DÉJÀ une dépendance déclarée du projet : ce composant
 * n'ajoute donc aucune bibliothèque. Il exploite ce qui était déjà là — zoom à
 * la molette, déplacement à la souris ou au doigt, grille, axes — au lieu de
 * réécrire un traceur à la main.
 *
 * CE COMPOSANT NE CALCULE RIEN
 *
 * C'est la règle qui structure tout le fichier. Il ne cherche pas où deux
 * droites se coupent, ne calcule pas un rayon, ne déduit pas la position d'un
 * point : `lib/math/geometry.ts` lui livre des primitives en nombres, et son
 * seul travail est de les TRADUIRE en éléments JSXGraph. Chaque genre d'objet a
 * donc exactement un endroit où sa forme est décidée, et ce n'est pas ici.
 *
 * Corollaire, et c'est le point qui compte : le plateau ne détient aucune
 * coordonnée. Tous les points qu'il crée pour appuyer un dessin sont FIXES —
 * les rendre déplaçables ferait du renderer une seconde source de vérité, ce
 * que toute cette architecture cherche précisément à éviter.
 *
 * TROIS PRÉCAUTIONS
 *
 *  - Le plateau est DÉTRUIT et RECONSTRUIT quand le thème change. C'est le seul
 *    moyen fiable de faire suivre la couleur des axes et des graduations :
 *    retoucher les attributs d'un plateau vivant dépend de détails internes de
 *    jsxgraph, alors qu'un changement de thème est un événement rare qui
 *    supporte bien un redessin complet.
 *  - La RÉCONCILIATION est faite objet par objet, par identifiant. Seul l'objet
 *    dont le dessin a réellement changé est retiré puis recréé ; les autres ne
 *    sont pas touchés. C'est ce qui rend inutile de temporiser la frappe :
 *    chaque touche ne coûte qu'une courbe, pas le plateau entier.
 *  - Les couleurs sont posées EXPLICITEMENT. Les valeurs par défaut de jsxgraph
 *    sont sombres : sur le fond sombre de l'application, des axes noirs
 *    seraient invisibles.
 */

/**
 * Le `.d.ts` livré par jsxgraph omet `enabled` de `ZoomOptions`. Ce n'est pas
 * une option inventée : le moteur la lit réellement (`base/board.js` :
 * `if (!this.attr.zoom.enabled || !this.attr.zoom.wheel || …) return;` —
 * sans `enabled`, le zoom à la molette est donc DÉSACTIVÉ). On décrit l'objet
 * réellement attendu au lieu de forcer un cast qui effacerait le contrôle.
 */
type ZoomOptions = JXG.ZoomOptions & { enabled: boolean };

const ZOOM: ZoomOptions = { enabled: true, wheel: true, needShift: false };

/**
 * Couleurs propres au plateau, par thème.
 *
 * `emphasis` est la couleur de MISE EN AVANT d'un objet sélectionné. Elle vaut
 * exactement `--app-text` de chaque thème : c'est le seul ton dont on soit sûr
 * qu'il contraste avec le fond du graphe dans les deux modes, puisque tout le
 * reste du texte de l'application l'emploie déjà. Une couleur d'accent plus
 * vive se confondrait avec la couleur propre de l'objet, qui peut être
 * n'importe laquelle de la palette.
 */
const THEME_COLORS = {
  light: { axis: "#9aa2ad", label: "#656d78", emphasis: "#101317" },
  dark: { axis: "#5b6472", label: "#9aa2ad", emphasis: "#f1f3f6" },
} as const;

/**
 * JSXGraph attend `[gauche, haut, droite, bas]` : son axe des ordonnées est
 * INVERSÉ par rapport à une fenêtre mathématique. C'est le seul endroit où
 * cette convention est traduite — tout le reste du code manipule `MathView`,
 * qui se lit comme une calculatrice (`yMin` en bas).
 */
function viewToBoundingBox(view: MathView): [number, number, number, number] {
  return [view.xMin, view.yMax, view.xMax, view.yMin];
}

/** L'inverse de `viewToBoundingBox` : le cadrage réellement affiché par le
 *  plateau, relu dans la convention du modèle. */
function boundingBoxToView(box: readonly number[]): MathView {
  return { xMin: box[0], xMax: box[2], yMin: box[3], yMax: box[1] };
}

/** Deux cadrages sont « identiques » en deçà de cette marge : on ne redessine
 *  pas le plateau pour un écart que personne ne peut voir. */
const VIEW_EPSILON = 1e-9;

function sameView(a: MathView, b: MathView): boolean {
  return (
    Math.abs(a.xMin - b.xMin) < VIEW_EPSILON &&
    Math.abs(a.xMax - b.xMax) < VIEW_EPSILON &&
    Math.abs(a.yMin - b.yMin) < VIEW_EPSILON &&
    Math.abs(a.yMax - b.yMax) < VIEW_EPSILON
  );
}

/**
 * Empreinte de ce que le renderer CONSOMME d'un objet.
 *
 * Tant qu'elle ne change pas, l'élément JSXGraph en place reste valable : il
 * n'y a rien à recréer. Elle contient donc les champs qui influencent le
 * dessin, et eux seuls. La POSITION n'y figure pas — elle est portée par
 * l'empreinte géométrique, qui est ajoutée à cette clé par `drawables`.
 */
function renderKey(object: MathObject): string {
  return [
    object.kind,
    object.definition,
    object.dependencies.join(","),
    object.style.color ?? "",
    object.style.width ?? "",
    object.style.pointSize ?? "",
    object.label ?? "",
  ].join("|");
}

// ── Traduction d'une primitive en éléments JSXGraph ───────────────────────

/** Ce que le modèle dit au renderer de poser sur l'écran. */
interface DrawStyle {
  color: string;
  width: number;
  pointSize: number;
  name: string;
  showLabel: boolean;
  /**
   * L'objet est-il celui que la construction désigne comme sélectionné ?
   *
   * Cette information entre dans la CLÉ de dessin, et pas seulement dans les
   * attributs : la réconciliation retire alors l'élément devenu faux et le
   * recrée mis en avant, exactement comme elle le fait pour un changement de
   * couleur ou de position. Il n'existe donc AUCUN chemin séparé pour la
   * sélection — un élément à l'écran reste, à tout instant, l'image fidèle de
   * sa clé.
   */
  selected: boolean;
  /** Couleur de mise en avant, propre au thème (voir `THEME_COLORS`). */
  emphasis: string;
}

/**
 * Une projection produit la LISTE des éléments qui la composent.
 *
 * Une liste, et non un élément : un segment a besoin de deux points d'appui
 * pour exister. Les oublier à la suppression laisserait deux points invisibles
 * s'accumuler à chaque modification — une fuite discrète, mais réelle.
 */
type Projection = (board: JXG.Board) => JXG.GeometryElement[];

/**
 * Point d'appui, INVISIBLE et FIXE.
 *
 * `fixed` n'est pas un détail de confort : c'est la traduction directe de la
 * règle « le renderer ne doit jamais être propriétaire des coordonnées ». Un
 * point déplaçable à la souris ferait diverger le dessin du modèle dès le
 * premier glissement.
 */
function createAnchor(
  board: JXG.Board,
  at: WorldPoint
): JXG.GeometryElement | null {
  const created: JXG.Point | undefined = board.create(
    "point",
    [at.x, at.y],
    {
      fixed: true,
      visible: false,
      withLabel: false,
      highlight: false,
      showInfobox: false,
      name: "",
    }
  );
  return created ?? null;
}

/** Épaisseur ajoutée à un trait sélectionné. Assez pour se voir, assez peu
 *  pour ne pas déformer la figure qu'on est en train de lire. */
const SELECTED_WIDTH_BOOST = 2;

/** Rayon ajouté à un point sélectionné. */
const SELECTED_SIZE_BOOST = 3;

/** Point VISIBLE : c'est un objet du modèle, pas un appui de dessin. */
function createVisiblePoint(
  board: JXG.Board,
  at: WorldPoint,
  style: DrawStyle
): JXG.GeometryElement | null {
  const created: JXG.Point | undefined = board.create(
    "point",
    [at.x, at.y],
    {
      fixed: true,
      visible: true,
      withLabel: style.showLabel,
      name: style.name,
      size: style.pointSize + (style.selected ? SELECTED_SIZE_BOOST : 0),
      // Le point sélectionné gagne un CONTOUR à la couleur du texte du thème.
      // Un simple grossissement se lirait comme un point mal réglé ; le
      // contour, lui, dit sans ambiguïté « c'est celui-là qui est désigné ».
      strokeColor: style.selected ? style.emphasis : style.color,
      strokeWidth: style.selected ? 2 : 1,
      fillColor: style.color,
      highlight: false,
      showInfobox: false,
      label: { strokeColor: style.color, fontSize: 12 },
    }
  );
  return created ?? null;
}

/**
 * Crée les points d'appui, puis l'élément principal.
 *
 * En cas d'échec, TOUT ce qui a été créé est retiré avant de repartir les
 * mains vides : un appui orphelin serait invisible et ne serait jamais
 * supprimé, puisque la réconciliation ne retient que ce qu'une projection a
 * renvoyé.
 */
function withAnchors(
  board: JXG.Board,
  points: readonly WorldPoint[],
  build: (anchors: JXG.Point[]) => JXG.GeometryElement | undefined
): JXG.GeometryElement[] {
  const anchors: JXG.Point[] = [];
  for (const at of points) {
    const anchor = createAnchor(board, at);
    if (!anchor) {
      if (anchors.length > 0) board.removeObject(anchors);
      return [];
    }
    anchors.push(anchor as JXG.Point);
  }

  const main = build(anchors);
  if (!main) {
    board.removeObject(anchors);
    return [];
  }
  return [...anchors, main];
}

/** Attributs communs aux traits — segment, droite, cercle, courbe. */
function lineAttributes(style: DrawStyle): JXG.LineAttributes {
  return {
    strokeColor: style.color,
    strokeWidth: style.width + (style.selected ? SELECTED_WIDTH_BOOST : 0),
    highlight: false,
    withLabel: false,
    name: style.name,
  };
}

/**
 * La traduction proprement dite : une primitive, un dessin.
 *
 * `null` signifie « le renderer ne sait pas dessiner cela ». Aucun genre
 * déclaré dans `RENDERED_KINDS` ne devrait y tomber — mais renvoyer `null`
 * plutôt que de lever garantit qu'un oubli se traduise par un objet non tracé,
 * jamais par un espace mathématique mort.
 */
function projectionOf(shape: Geometry, style: DrawStyle): Projection | null {
  switch (shape.kind) {
    case "function":
      return (board) => {
        // Les bornes passées à jsxgraph ne sont qu'un PLAFOND : le moteur
        // restreint lui-même le tracé à la zone visible (majorée de 30 %).
        // Elles sont donc larges, pour qu'un zoom arrière ne tronque pas la
        // courbe ; les resserrer n'apporterait rien.
        const graph: JXG.Functiongraph | undefined = board.create(
          "functiongraph",
          [shape.evaluate, -1e5, 1e5],
          lineAttributes(style)
        );
        return graph ? [graph] : [];
      };

    case "point":
      return (board) => {
        const point = createVisiblePoint(board, shape.at, style);
        return point ? [point] : [];
      };

    case "linear": {
      const anchors = linearAnchors(shape);
      return (board) =>
        withAnchors(board, anchors, (points) =>
          shape.bounded
            ? board.create("segment", points, lineAttributes(style))
            : board.create("line", points, lineAttributes(style))
        );
    }

    case "circle": {
      const anchors = circleAnchors(shape);
      return (board) =>
        withAnchors(board, anchors, (points) =>
          board.create("circle", points, lineAttributes(style))
        );
    }
  }
}

/**
 * Un objet du modèle, prêt à être projeté — et de quoi savoir si le dessin en
 * place est encore valable.
 */
interface Drawable {
  object: MathObject;
  key: string;
  /** Sert à la légende : elle doit dire la même chose que le dessin. */
  selected: boolean;
  project: Projection;
}

interface DrawnElement {
  key: string;
  elements: JXG.GeometryElement[];
}

// ── Interaction ───────────────────────────────────────────────────────────

/**
 * Ce qu'un clic sur le plateau a produit.
 *
 * Le renderer ne dit pas ce qu'il faut en FAIRE : il rapporte des coordonnées,
 * l'échelle du moment et l'objet visé, et l'appelant décide selon l'outil
 * actif. Un outil de création pose un point ; le mode sélection sélectionne.
 * Le renderer, lui, ignore jusqu'à l'existence des outils.
 */
export interface CanvasPick {
  /** Position du clic, en coordonnées mathématiques. */
  world: WorldPoint;
  /** Échelle au moment du clic — les tolérances de préhension s'y rapportent. */
  scale: PixelScale;
  /** Objet visé, ou `null` si le clic tombe dans le vide. */
  objectId: string | null;
}

/**
 * Déplacement, en pixels, au-delà duquel un clic est en réalité un glissement.
 *
 * Sans ce seuil, déplacer la vue créerait un point à chaque fois : le plateau
 * distingue « clic » et « glisser » par la distance parcourue entre l'appui et
 * le relâchement, jamais par le bouton utilisé. C'est aussi ce qui rend le
 * geste identique à la souris et au doigt.
 */
const CLICK_SLOP_PIXELS = 5;

/** Position du clic en coordonnées mathématiques, ou `null` si l'événement
 *  n'en porte pas. */
function readWorldPoint(board: JXG.Board, event: PointerEvent): WorldPoint | null {
  // `getUsrCoordsOfMouse` est l'idiome que jsxgraph documente lui-même pour
  // convertir un événement en coordonnées (`board.on('up', evt => …)`). Il lit
  // `clientX` et `touches` : il fonctionne donc à la souris COMME au doigt,
  // sans code séparé — c'est ce qui rend le tactile possible sans le traiter à
  // part.
  const coords = board.getUsrCoordsOfMouse(event);
  if (!coords) return null;
  const point = { x: coords[0], y: coords[1] };
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return point;
}

/** Échelle réellement affichée par le plateau — le cadrage du modèle ne suit
 *  pas les déplacements de l'utilisateur, il ne peut donc pas servir ici. */
function currentScale(board: JXG.Board): PixelScale {
  return pixelScale(
    board.canvasWidth,
    board.canvasHeight,
    boundingBoxToView(board.getBoundingBox())
  );
}

/**
 * Écran tactile ? — interrogé AU MOMENT DU CLIC, jamais mémorisé au montage.
 *
 * Une tablette à laquelle on branche une souris change de pointeur principal
 * en cours de séance ; un état figé à l'ouverture se tromperait ensuite. Le
 * test est celui du projet — `src/index.css` emploie déjà
 * `(hover: hover) and (pointer: fine)` pour le bouton d'épinglage — et il
 * porte sur le pointeur PRINCIPAL : une largeur d'écran ne dit rien de la
 * présence d'un doigt, puisqu'une tablette est tactile ET large.
 */
const COARSE_POINTER = "(pointer: coarse)";

/** Facteur d'élargissement de la zone de préhension au doigt. Une cible de
 *  22 px devient ≈ 35 px, sans aller jusqu'à confondre deux points voisins. */
const TOUCH_PICK_BOOST = 1.6;

/**
 * L'échelle à confier à `pickObject`, élargie si l'on désigne au doigt.
 *
 * `pickObject` compare une distance exprimée EN PIXELS à un rayon fixe — 11 px,
 * soit une cible de 22 px, en deçà des 24 px que demande le minimum
 * d'accessibilité. C'est assez pour un curseur, pas pour un doigt.
 *
 * L'échelle est le levier prévu pour cela, et le seul : `pixelDistance` DIVISE
 * par elle, donc une échelle plus petite rend le test plus permissif.
 * `geometry.ts` n'est donc pas touché — il est appelé avec une échelle adaptée
 * au pointeur, ce qui est exactement le rôle de ce paramètre.
 *
 * La VRAIE échelle reste dans `pick.scale` : elle décrit le plateau, elle sert
 * au seuil de clic ci-dessus, et elle doit continuer à dire la vérité.
 */
function toleranceScale(scale: PixelScale): PixelScale {
  if (typeof window.matchMedia !== "function") return scale;
  if (!window.matchMedia(COARSE_POINTER).matches) return scale;
  return { x: scale.x / TOUCH_PICK_BOOST, y: scale.y / TOUCH_PICK_BOOST };
}

export function MathGraph({
  construction,
  ordering,
  geometry,
  theme,
  title = "Graphe",
  onResetView,
  onPick,
  hint,
  overlay,
}: {
  construction: MathConstruction;
  /** Objets ordonnés par dépendances, et ceux qui ne peuvent pas être rendus. */
  ordering: ResolvedConstruction;
  /** Primitive de chaque objet — calculée par `lib/math/geometry.ts`. */
  geometry: GeometryResolution;
  theme: "light" | "dark";
  title?: string;
  /** Prévient le propriétaire du modèle que le cadrage est revenu à l'origine. */
  onResetView?: () => void;
  /** Un clic franc (et non un glissement) sur le plateau. */
  onPick?: (pick: CanvasPick) => void;
  /** Remplace la phrase d'aide, pour un panneau qui a ses propres gestes. */
  hint?: string;
  /**
   * Contenu posé PAR-DESSUS le plateau — l'accueil d'une construction vide.
   *
   * C'est un simple emplacement, sans logique : le graphe ne sait pas ce qu'on
   * lui donne, et n'a pas à le savoir. Le placer ici plutôt que dans le
   * panneau appelant est nécessaire — lui seul connaît la position exacte du
   * plateau, qu'un parent ne pourrait viser qu'en la devinant.
   */
  overlay?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<JXG.Board | null>(null);
  const drawnRef = useRef<Map<string, DrawnElement>>(new Map());
  /**
   * Cadrage déjà appliqué au plateau. Il sert à distinguer « le modèle demande
   * un cadrage que le plateau ne montre pas encore » de « le modèle n'a pas
   * bougé ». Sans lui, l'effet de cadrage rappellerait `setBoundingBox` à
   * chaque rendu et annulerait le déplacement de l'utilisateur.
   */
  const appliedViewRef = useRef<MathView>(DEFAULT_VIEW);
  /**
   * Cadrage d'OUVERTURE, figé au premier rendu.
   *
   * L'effet de création ne doit pas dépendre du cadrage courant : il serait
   * alors rejoué à chaque changement de vue, et détruirait le plateau pour un
   * simple recentrage. On lit donc la valeur initiale ici, et les changements
   * ultérieurs passent par l'effet de cadrage.
   */
  const initialViewRef = useRef<MathView | null>(null);
  if (initialViewRef.current === null) initialViewRef.current = construction.view;

  /**
   * Ce que le renderer doit montrer, calculé UNE fois et lu par deux
   * consommateurs : le dessin et la légende. La légende ne peut donc pas
   * annoncer un objet qui n'est pas tracé, ni en oublier un.
   *
   * La SÉLECTION entre dans cette liste, et c'est délibéré. Recalculer la
   * liste coûte un parcours d'objets — pas un seul calcul géométrique, que
   * `useMathConstruction` a déjà mémoïsé en amont et qui ne dépend pas de la
   * sélection. Ce qui est recréé à l'écran se limite aux objets dont la clé a
   * changé, c'est-à-dire, au plus, l'ancien et le nouveau sélectionné.
   */
  const selectedId = construction.selection.selectedObjectId;

  const drawables = useMemo(() => {
    const list: Drawable[] = [];
    const emphasis = THEME_COLORS[theme].emphasis;

    for (const object of ordering.ordered) {
      // L'ordre du modèle décide de l'ordre de dessin : un objet vient après
      // ses dépendances, donc par-dessus elles.
      if (!object.visible) continue;
      if (ordering.blocked.has(object.id)) continue;
      if (!RENDERED_KINDS.has(object.kind)) continue;

      const shape = geometry.shapes.get(object.id);
      if (!shape) continue;

      const selected = object.id === selectedId;

      const style: DrawStyle = {
        color: object.style.color ?? DEFAULT_OBJECT_COLOR,
        width: object.style.width ?? 2,
        pointSize: object.style.pointSize ?? DEFAULT_POINT_SIZE,
        name: object.label ?? object.id,
        // Seuls les points portent une étiquette sur le dessin : « A » situe un
        // point, alors que « s » ou « c » posés au milieu d'une figure
        // l'encombreraient sans rien apprendre.
        showLabel: object.kind === "point",
        selected,
        emphasis,
      };

      const project = projectionOf(shape, style);
      if (!project) continue;

      list.push({
        object,
        // L'empreinte GÉOMÉTRIQUE est indispensable ici : la définition d'un
        // segment ne change pas quand on déplace son extrémité, seul le dessin
        // change. Sans elle, déplacer un point ne redessinerait pas les objets
        // qui en dépendent. La sélection y figure pour la même raison : elle
        // change l'aspect sans changer ni l'objet ni sa géométrie.
        key: `${renderKey(object)}|${fingerprint(shape)}|${selected ? "1" : "0"}`,
        selected,
        project,
      });
    }
    return list;
  }, [ordering, geometry, selectedId, theme]);

  /**
   * Dernière valeurs lues par les gestionnaires d'événements.
   *
   * L'écoute du plateau est posée UNE fois, à sa création : elle ne peut donc
   * pas lire les variables du rendu courant. Ce relais, remis à jour après
   * chaque rendu, évite de réabonner les événements à chaque changement du
   * modèle.
   */
  const interactionRef = useRef<{
    onPick: ((pick: CanvasPick) => void) | undefined;
    objects: readonly MathObject[];
    shapes: ReadonlyMap<string, Geometry>;
  }>({ onPick: undefined, objects: [], shapes: new Map() });

  useEffect(() => {
    interactionRef.current = {
      onPick,
      objects: ordering.ordered,
      shapes: geometry.shapes,
    };
  });

  // ── Création du plateau (et recréation au changement de thème) ──────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const colors = THEME_COLORS[theme];
    const view = initialViewRef.current ?? DEFAULT_VIEW;
    const board = JXG.JSXGraph.initBoard(container, {
      boundingbox: viewToBoundingBox(view),
      axis: true,
      grid: true,
      showCopyright: false,
      showNavigation: false,
      keepAspectRatio: false,
      renderer: "canvas",
      pan: { enabled: true, needShift: false },
      zoom: ZOOM,
      defaultAxes: {
        x: {
          strokeColor: colors.axis,
          ticks: {
            strokeColor: colors.axis,
            label: { strokeColor: colors.label, fontSize: 11 },
          },
        },
        y: {
          strokeColor: colors.axis,
          ticks: {
            strokeColor: colors.axis,
            label: { strokeColor: colors.label, fontSize: 11 },
          },
        },
      },
    });

    boardRef.current = board;
    drawnRef.current = new Map();
    appliedViewRef.current = view;

    // ── Clic sur le plateau ──
    // L'appui et le relâchement sont examinés ensemble : c'est leur écart qui
    // dit s'il s'agissait d'un clic ou d'un déplacement de la vue. Les
    // gestionnaires sont posés sur le PLATEAU, pas sur les éléments : ils
    // reçoivent donc aussi les clics dans le vide, ce qui est nécessaire pour
    // désélectionner ou pour poser un point n'importe où.
    let pressedAt: WorldPoint | null = null;

    const handleDown = (event: PointerEvent) => {
      pressedAt = readWorldPoint(board, event);
    };

    const handleUp = (event: PointerEvent) => {
      const start = pressedAt;
      pressedAt = null;

      const interaction = interactionRef.current;
      if (!start || !interaction.onPick) return;

      const world = readWorldPoint(board, event);
      if (!world) return;

      const scale = currentScale(board);
      const movedPixels = Math.hypot(
        (world.x - start.x) / scale.x,
        (world.y - start.y) / scale.y
      );
      // Au-delà du seuil, c'était un déplacement de la vue : il ne crée rien et
      // ne sélectionne rien.
      if (movedPixels > CLICK_SLOP_PIXELS) return;

      interaction.onPick({
        world,
        scale,
        objectId: pickObject(
          interaction.objects,
          interaction.shapes,
          world,
          // Tolérance élargie au doigt, mais échelle VRAIE dans `pick.scale`.
          toleranceScale(scale)
        ),
      });
    };

    board.on("down", handleDown);
    board.on("up", handleUp);

    return () => {
      board.off("down", handleDown);
      board.off("up", handleUp);
      drawnRef.current = new Map();
      boardRef.current = null;
      // `freeBoard` retire aussi le conteneur du DOM : le rappeler au
      // remontage (mode strict de React en développement) repart donc d'une
      // page propre, sans superposer deux plateaux.
      JXG.JSXGraph.freeBoard(board);
    };
  }, [theme]);

  // ── Réconciliation des objets ───────────────────────────────────────
  // Déclaré APRÈS la création : React exécute les effets dans l'ordre de
  // déclaration, le plateau existe donc déjà ici. `theme` figure dans les
  // dépendances parce qu'un plateau recréé est un plateau vide : il faut le
  // repeupler même si les objets, eux, n'ont pas changé.
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const wanted = new Map<string, Drawable>();
    for (const drawable of drawables) wanted.set(drawable.object.id, drawable);

    let changed = false;

    // 1) Retirer ce qui n'est plus voulu, ou dont le dessin a changé.
    for (const [id, drawn] of drawnRef.current) {
      const drawable = wanted.get(id);
      if (drawable && drawable.key === drawn.key) continue;
      // En ordre INVERSE de création — l'élément principal d'abord, ses points
      // d'appui ensuite. C'est l'ordre que jsxgraph recommande lui-même, et
      // c'est le seul qui ne laisse pas d'appui orphelin.
      for (let index = drawn.elements.length - 1; index >= 0; index -= 1) {
        board.removeObject(drawn.elements[index]);
      }
      drawnRef.current.delete(id);
      changed = true;
    }

    // 2) Créer ce qui manque. Les autres éléments sont LAISSÉS EN PLACE : ils
    //    gardent leur identité, donc l'utilisateur qui a zoomé sur une figure
    //    ne la voit pas sauter parce qu'une autre a été modifiée.
    for (const drawable of drawables) {
      const id = drawable.object.id;
      if (drawnRef.current.has(id)) continue;

      let elements: JXG.GeometryElement[] = [];
      try {
        elements = drawable.project(board);
      } catch {
        // FILET, et non chemin normal : tout ce qui pouvait être vérifié l'a
        // été par `geometry.ts` avant d'arriver ici. Il est là pour qu'un refus
        // inattendu de la bibliothèque graphique ne fasse pas tomber l'espace
        // mathématique entier — l'objet reste alors non tracé, et le reste de
        // la construction continue de s'afficher.
        elements = [];
      }

      if (elements.length === 0) continue;
      drawnRef.current.set(id, { key: drawable.key, elements });
      changed = true;
    }

    if (changed) board.update();
  }, [drawables, theme]);

  // ── Cadrage piloté par le modèle ────────────────────────────────────
  // Le déplacement et le zoom de l'utilisateur ne REMONTENT pas dans le
  // modèle : les y écrire à chaque image re-rendrait tout l'espace de travail
  // au moindre mouvement de souris. Le cadrage du modèle est donc celui
  // d'ouverture, plus ceux qu'on lui demande explicitement — et cet effet est
  // le chemin par lequel une telle demande atteint le plateau.
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    if (sameView(appliedViewRef.current, construction.view)) return;
    board.setBoundingBox(viewToBoundingBox(construction.view), true);
    appliedViewRef.current = construction.view;
  }, [construction.view]);

  /**
   * Recentrer.
   *
   * Le plateau est remis à l'origine DIRECTEMENT, sans attendre le modèle :
   * après un déplacement à la souris, le modèle est déjà au cadrage d'origine
   * et ne changerait donc pas — l'effet de cadrage ne se déclencherait pas, et
   * le bouton semblerait cassé. On prévient ensuite le modèle, pour que les
   * deux restent d'accord.
   */
  function resetView() {
    boardRef.current?.setBoundingBox(viewToBoundingBox(DEFAULT_VIEW), true);
    appliedViewRef.current = DEFAULT_VIEW;
    onResetView?.();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3" aria-live="polite">
          {drawables.length === 0 ? (
            <span className="text-[12px]" style={{ color: "var(--app-text-subtle)" }}>
              Aucun objet tracé.
            </span>
          ) : (
            drawables.map(({ object, selected }) => (
              <span
                key={object.id}
                className="inline-flex items-center gap-1.5 text-[12px]"
                style={{
                  color: selected ? "var(--app-text)" : "var(--app-text-muted)",
                  fontWeight: selected ? 600 : 400,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: object.kind === "point" ? "50%" : 3,
                    backgroundColor: object.style.color ?? DEFAULT_OBJECT_COLOR,
                    // Le même signal que sur le plateau : un anneau. La
                    // légende et le dessin disent ainsi la même chose, sans
                    // que l'un ait à interroger l'autre.
                    boxShadow: selected ? "0 0 0 2px var(--app-text)" : undefined,
                  }}
                />
                <span className="app-mono">{object.label ?? object.id}</span>
              </span>
            ))
          )}
        </div>
        <button type="button" className="app-btn app-btn-ghost" onClick={resetView}>
          <Maximize2 size={14} aria-hidden="true" />
          Recentrer
        </button>
      </div>

      {/* Le plateau et son éventuel contenu d'accueil partagent ce repère :
          c'est ce qui permet de poser l'accueil SUR le graphe, et non à côté. */}
      <div className="relative">
        <div
          ref={containerRef}
          className="app-graph"
          role="img"
          aria-label={`${title} — utilise la molette pour zoomer et le glisser-déposer pour te déplacer.`}
        />
        {overlay}
      </div>
      <p className="text-[11.5px]" style={{ color: "var(--app-text-subtle)" }}>
        {hint ??
          "Molette pour zoomer, glisser pour déplacer. Le tracé est coupé aux valeurs non définies (par exemple en 0 pour 1/x) : les deux branches ne sont jamais reliées à tort."}
      </p>
    </div>
  );
}
