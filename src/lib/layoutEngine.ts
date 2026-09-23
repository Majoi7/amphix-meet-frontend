/**
 * MOTEUR DE LAYOUT — module PUR, sans aucune dépendance React.
 *
 * Rôle : recevoir une description de la réunion (tuiles, espace réellement
 * disponible, épingles) et retourner une description géométrique complète du
 * rendu. Le composant React ne décide plus rien : il applique le résultat.
 *
 * Principe de priorité (du plus fort au plus faible) :
 *
 *   GLOBAL PIN > LOCAL PIN > SCREEN SHARE > ACTIVE SPEAKER > AUTO LAYOUT
 *
 * Règle de forme : un PROFIL PARTICIPANT est toujours CARRÉ. Ce n'est pas une
 * propriété CSS posée après coup — c'est le moteur qui calcule un côté unique
 * et l'applique à la largeur comme à la hauteur. La règle ne concerne pas la
 * zone principale d'un partage d'écran, qui garde son ratio et n'est jamais
 * rognée.
 *
 * Quatre dispositions possibles, choisies par le moteur :
 *
 *  - `single` : une seule tuile, centrée ;
 *  - `grid`   : grille de carrés de taille égale ;
 *  - `stage`  : un partage d'écran en zone principale, les autres en bandeau ;
 *  - `focus`  : un PROFIL ÉPINGLÉ en zone principale, environ deux fois plus
 *               grand qu'une tuile du bandeau (voir `focusLayout`).
 *
 * Règle critique du partage d'écran local : quand l'utilisateur local partage
 * son écran, sa caméra est RETIRÉE de la liste des tuiles rendues. Elle reste
 * publiée dans LiveKit — on ne fait que cacher son rendu. Dès que le partage
 * s'arrête, elle réapparaît automatiquement (l'appelant repasse la liste
 * complète).
 */

/** Source d'une tuile : caméra ou partage d'écran. */
export type LayoutSource = "camera" | "screenshare";

/** Une tuile candidate au rendu. */
export interface LayoutTile {
  /** Clé stable et unique (identité + source). */
  id: string;
  identity: string;
  source: LayoutSource;
  isLocal: boolean;
  isSpeaking: boolean;
  /** false = caméra coupée / piste non publiée → avatar. */
  hasVideo: boolean;
  name: string;
  /** Ordre d'arrivée, sert de départage stable. */
  arrivalIndex: number;
}

/** Une épingle (locale ou globale). */
export interface LayoutPin {
  identity: string;
  source: LayoutSource;
}

export interface LayoutViewport {
  width: number;
  height: number;
}

export interface LayoutInput {
  tiles: LayoutTile[];
  /** Espace réellement disponible, mesuré (ResizeObserver). */
  viewport: LayoutViewport;
  pins: {
    global: LayoutPin | null;
    local: LayoutPin | null;
  };
  /** L'utilisateur local partage-t-il son écran en ce moment ? */
  localScreenShareActive: boolean;
  /** Marge entre les tuiles, en pixels. */
  gap?: number;
}

export interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutSlot {
  tile: LayoutTile;
  rect: LayoutRect;
}

export type LayoutMode = "empty" | "single" | "grid" | "stage" | "focus";

export interface LayoutResult {
  mode: LayoutMode;
  /** Zone principale (une seule tuile proéminente) — null en mode grille pure. */
  main: LayoutSlot | null;
  /** Tuiles secondaires, avec leur position calculée. */
  secondary: LayoutSlot[];
  /** Vignette flottante de la caméra locale — null si masquée ou inutile. */
  selfView: LayoutSlot | null;
  /** Orientation du bandeau secondaire en modes "stage" et "focus". */
  strip: "row" | "column" | null;
  /**
   * Fenêtre occupée par le bandeau secondaire, en coordonnées de scène.
   *
   * Le rendu s'en sert directement comme conteneur de défilement. Elle est
   * retournée par le moteur plutôt que déduite des bornes de la zone
   * principale : en mode « focus », le bandeau est plus haut (ou plus large)
   * que la tuile épinglée, et cette déduction rognerait des tuiles.
   */
  stripRect: LayoutRect | null;
  /** true si le bandeau déborde et doit défiler. */
  stripScrolls: boolean;
  gap: number;
}

/* ------------------------------------------------------------------ */
/* Constantes de calibrage                                             */
/* ------------------------------------------------------------------ */

/**
 * Ratio d'un PROFIL PARTICIPANT : 1 (carré).
 *
 * C'est une règle de rendu, pas une préférence esthétique. Elle vaut pour
 * tous les participants, quel que soit leur nombre, la taille de la fenêtre
 * ou la présence d'un partage d'écran.
 */
const PARTICIPANT_TILE_RATIO = 1;
/** Ratio d'une tuile de partage d'écran (elle, jamais rognée). */
const SCREEN_TILE_RATIO = 16 / 9;
/** Ratio de la vignette caméra flottante (≈16:10, cf. partage-ecran.svg). */
const SELF_VIEW_RATIO = 16 / 10;

/**
 * Retrait appliqué au côté d'une tuile carrée, pour aérer la composition.
 *
 * Les cellules sont déjà séparées par `gap` ; ce facteur ajoute une marge
 * supplémentaire à l'intérieur de chaque cellule. Il rend aussi la grille
 * légèrement plus petite sans jamais casser le carré : `side` reste une
 * valeur unique, donc largeur et hauteur restent strictement égales.
 */
const SQUARE_TILE_FILL = 0.94;

/**
 * Coût, en pixels de côté, d'une case vide.
 *
 * Sans cette pénalité, une rangée unique de tuiles minuscules battrait une
 * grille pleine : `side` y serait plus grand. Elle force à préférer une
 * grille complète tant que l'écart de taille reste raisonnable.
 */
const EMPTY_CELL_COST_PX = 90;

/** En dessous de cette largeur de tuile, le rendu devient illisible. */
const MIN_TILE_W = 120;
/** En dessous de cette hauteur de tuile, le rendu devient illisible. */
const MIN_TILE_H = 80;
/** Côté minimal d'une tuile carrée (bandeau secondaire). */
const MIN_TILE_SIDE = 88;
/** Largeur maximale d'une tuile unique centrée. */
const SINGLE_MAX_W = 1180;
/** Taille maximale de la vignette caméra flottante. */
const SELF_VIEW_MAX_W = 280;
/** Taille minimale de la vignette caméra flottante. */
const SELF_VIEW_MIN_W = 132;

/** Marge intérieure appliquée autour des tuiles. */
const STAGE_PADDING = 8;

/** Au-delà de ce ratio largeur/hauteur, le bandeau secondaire passe à droite. */
const COLUMN_STRIP_THRESHOLD = 1.35;

/**
 * Rapport de taille visé, en mode « focus », entre le PROFIL ÉPINGLÉ et une
 * tuile du bandeau : le premier doit faire environ deux fois le second.
 *
 * Ce n'est pas une transformation CSS : le moteur réserve réellement
 * `FOCUS_SCALE × s` de côté à la tuile épinglée, et `s` aux autres. La
 * géométrie est donc exacte, sans recouvrement ni débordement.
 */
const FOCUS_SCALE = 2;

/**
 * Nombre de tuiles du bandeau qu'on cherche à garder visibles sans défiler en
 * mode « focus ».
 *
 * C'est ce qui borne le côté `s` du bandeau — et donc, par ricochet, la taille
 * du profil épinglé : un profil deux fois plus grand ne sert à rien si les
 * autres participants deviennent inatteignables. Au-delà, le bandeau défile.
 */
const FOCUS_STRIP_MIN_VISIBLE = 2;

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/** Même tuile ? (même participant, même source) */
function pinMatchesTile(pin: LayoutPin | null, tile: LayoutTile): boolean {
  return !!pin && pin.identity === tile.identity && pin.source === tile.source;
}

/**
 * Rang d'une tuile dans le bandeau secondaire — et non plus l'ordre brut de
 * LiveKit, qui ne garantit rien.
 *
 *  0. la caméra (ou l'avatar) du participant en zone principale — le
 *     présentateur doit rester VISIBLE : sans ce rang, un bandeau qui déborde
 *     pouvait repousser sa tuile hors de la zone visible, et le partage se
 *     retrouvait sans visage ;
 *  1. une tuile épinglée (locale ou globale) — quand deux épingles coexistent,
 *     la seconde ne doit pas se perdre au fond du bandeau ;
 *  2. les autres partages d'écran ;
 *  3. les autres caméras.
 *
 * `sort` est stable : à rang égal, l'ordre d'origine est conservé, donc les
 * tuiles ne « sautent » pas d'un rendu à l'autre.
 */
function stripRank(
  tile: LayoutTile,
  main: LayoutTile,
  pins: LayoutInput["pins"]
): number {
  if (tile.identity === main.identity) return 0;
  if (pinMatchesTile(pins.global, tile) || pinMatchesTile(pins.local, tile)) return 1;
  if (tile.source === "screenshare") return 2;
  return 3;
}

function orderStripTiles(
  main: LayoutTile,
  candidates: LayoutTile[],
  pins: LayoutInput["pins"]
): LayoutTile[] {
  return [...candidates].sort((a, b) => stripRank(a, main, pins) - stripRank(b, main, pins));
}

/**
 * Élit la tuile principale selon la priorité :
 * global pin > local pin > screen share (le plus récent) > orateur > première.
 */
function electMain(tiles: LayoutTile[], pins: LayoutInput["pins"]): LayoutTile | null {
  if (tiles.length === 0) return null;

  const globalPinned = tiles.find((t) => pinMatchesTile(pins.global, t));
  if (globalPinned) return globalPinned;

  const localPinned = tiles.find((t) => pinMatchesTile(pins.local, t));
  if (localPinned) return localPinned;

  // Le partage d'écran le plus récent (le dernier arrivé dans la liste).
  const screenShares = tiles.filter((t) => t.source === "screenshare");
  if (screenShares.length > 0) return screenShares[screenShares.length - 1];

  const speaking = tiles.find((t) => t.isSpeaking);
  if (speaking) return speaking;

  return tiles.reduce((oldest, t) => (t.arrivalIndex < oldest.arrivalIndex ? t : oldest), tiles[0]);
}

/**
 * Cherche la meilleure grille CARRÉE pour `count` tuiles dans une zone `w × h`.
 *
 * Il n'y a plus de ratio cible à approcher : chaque cellule est ramenée à un
 * carré, dont le côté vaut `min(cellW, cellH)`. Le seul critère qui compte
 * devient donc la TAILLE de ce carré — on maximise `side`, en pénalisant les
 * cases vides pour qu'une rangée de tuiles minuscules ne batte pas une grille
 * pleine. Le résultat dépend entièrement de l'espace mesuré.
 */
function bestSquareGrid(
  count: number,
  w: number,
  h: number,
  gap: number
): { cols: number; rows: number; side: number } {
  let best: { cols: number; rows: number; side: number; score: number } | null = null;

  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const cellW = (w - gap * (cols - 1)) / cols;
    const cellH = (h - gap * (rows - 1)) / rows;
    if (cellW <= 0 || cellH <= 0) continue;

    const side = Math.min(cellW, cellH) * SQUARE_TILE_FILL;
    const emptyRatio = (cols * rows - count) / count;
    const score = side - emptyRatio * EMPTY_CELL_COST_PX;

    if (!best || score > best.score) {
      best = { cols, rows, side, score };
    }
  }

  // Repli improbable (viewport dégénéré) : une seule colonne.
  if (!best) {
    return { cols: 1, rows: count, side: Math.max(Math.min(w, h / count), 1) };
  }
  return best;
}

/**
 * Place `count` cellules CARRÉES de `side × side` dans une zone `w × h`.
 * Chaque rangée incomplète est centrée horizontalement — c'est ce qui
 * distingue une grille « moteur de layout » d'un `grid-cols-4` rigide.
 *
 * Largeur et hauteur reçoivent la MÊME valeur : le carré est garanti par la
 * géométrie calculée, pas par une propriété CSS appliquée après coup.
 */
function placeGrid(
  count: number,
  w: number,
  h: number,
  gap: number,
  cols: number,
  side: number
): LayoutRect[] {
  const rows = Math.ceil(count / cols);
  const totalH = rows * side + (rows - 1) * gap;
  const offsetY = Math.max((h - totalH) / 2, 0);

  const rects: LayoutRect[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = Math.min(cols, count - row * cols);
    const rowW = inRow * side + (inRow - 1) * gap;
    const offsetX = Math.max((w - rowW) / 2, 0);

    rects.push({
      x: offsetX + col * (side + gap),
      y: offsetY + row * (side + gap),
      w: side,
      h: side,
    });
  }
  return rects;
}

/** Rectangle 16:9 (ou autre ratio) centré dans une zone, avec marge. */
function centeredBox(w: number, h: number, ratio: number, padding: number): LayoutRect {
  const availW = Math.max(w - padding * 2, 1);
  const availH = Math.max(h - padding * 2, 1);

  let boxW = Math.min(availW, SINGLE_MAX_W);
  let boxH = boxW / ratio;
  if (boxH > availH) {
    boxH = availH;
    boxW = boxH * ratio;
  }
  return {
    x: (w - boxW) / 2,
    y: (h - boxH) / 2,
    w: boxW,
    h: boxH,
  };
}

/** Vignette flottante ancrée en bas à droite d'une zone, sans jamais déborder. */
function selfViewRect(within: LayoutRect): LayoutRect {
  const margin = 16;
  let boxW = clamp(within.w * 0.18, SELF_VIEW_MIN_W, SELF_VIEW_MAX_W);
  let boxH = boxW / SELF_VIEW_RATIO;

  const maxH = within.h * 0.45;
  if (boxH > maxH) {
    boxH = maxH;
    boxW = boxH * SELF_VIEW_RATIO;
  }
  // Ne jamais dépasser la zone, même sur un écran très étroit.
  boxW = Math.min(boxW, Math.max(within.w - margin * 2, 1));
  boxH = Math.min(boxH, Math.max(within.h - margin * 2, 1));

  return {
    x: within.x + within.w - boxW - margin,
    y: within.y + within.h - boxH - margin,
    w: boxW,
    h: boxH,
  };
}

/* ------------------------------------------------------------------ */
/* Point d'entrée                                                      */
/* ------------------------------------------------------------------ */

export function computeLayout(input: LayoutInput): LayoutResult {
  const gap = input.gap ?? 8;
  const { width: vw, height: vh } = input.viewport;

  const empty: LayoutResult = {
    mode: "empty",
    main: null,
    secondary: [],
    selfView: null,
    strip: null,
    stripRect: null,
    stripScrolls: false,
    gap,
  };

  // Viewport non encore mesuré : on ne devine rien.
  if (vw <= 0 || vh <= 0) return empty;

  /* --- 1. FILTRAGE -------------------------------------------------
   * Règle absolue : pendant MON partage d'écran, ma caméra disparaît du
   * rendu. Elle n'est ni dépubliée ni arrêtée — simplement pas dessinée.
   * Si le partage s'arrête, `localScreenShareActive` repasse à false et la
   * tuile revient d'elle-même : aucun état à réinitialiser.
   */
  const localScreenShareActive =
    input.localScreenShareActive || input.tiles.some((t) => t.isLocal && t.source === "screenshare");

  const tiles = localScreenShareActive
    ? input.tiles.filter((t) => !(t.isLocal && t.source === "camera"))
    : input.tiles;

  if (tiles.length === 0) return empty;

  const localCamera = tiles.find((t) => t.isLocal && t.source === "camera") ?? null;
  const stage: LayoutRect = {
    x: STAGE_PADDING,
    y: STAGE_PADDING,
    w: Math.max(vw - STAGE_PADDING * 2, 1),
    h: Math.max(vh - STAGE_PADDING * 2, 1),
  };

  const main = electMain(tiles, input.pins);
  const others = main ? tiles.filter((t) => t.id !== main.id) : tiles;
  const hasScreenShare = tiles.some((t) => t.source === "screenshare");

  /**
   * La tuile principale est-elle le fait d'une ÉPINGLE ?
   *
   * C'est la seule question qui distingue le mode « focus » du reste : une
   * tuile élue par défaut (orateur actif, plus ancien arrivé) ne doit pas
   * soudain prendre deux fois la place des autres. Seule une action explicite
   * de l'utilisateur — « pour moi » ou « pour tous » — y donne droit.
   */
  const mainIsPinned =
    !!main &&
    (pinMatchesTile(input.pins.global, main) || pinMatchesTile(input.pins.local, main));

  /* --- 2. MODE ----------------------------------------------------- */

  // Une seule tuile : centrée, taille bornée. Un profil participant est
  // carré, un partage d'écran garde son ratio (on ne rogne jamais du
  // contenu partagé).
  if (tiles.length === 1) {
    const ratio = tiles[0].source === "screenshare" ? SCREEN_TILE_RATIO : PARTICIPANT_TILE_RATIO;
    const rect = centeredBox(stage.w, stage.h, ratio, 8);
    return {
      mode: "single",
      main: { tile: tiles[0], rect },
      secondary: [],
      selfView: null,
      strip: null,
      stripRect: null,
      stripScrolls: false,
      gap,
    };
  }

  // PROFIL ÉPINGLÉ — priorité la plus haute de la hiérarchie
  // (GLOBAL PIN > LOCAL PIN > SCREEN SHARE). Une caméra épinglée prend donc
  // la zone principale même si un partage d'écran est en cours : le partage
  // reste visible, dans le bandeau.
  if (main && mainIsPinned && main.source === "camera") {
    return focusLayout(main, others, stage, gap, input.pins);
  }

  // Le mode « scène » n'est légitime que si la zone principale est RÉELLEMENT
  // un partage d'écran. Si une épingle y a placé une caméra alors qu'un
  // partage existe ailleurs, on retombe sur la grille carrée : un profil
  // participant ne doit jamais se retrouver étiré dans la zone principale.
  if (hasScreenShare && main && main.source === "screenshare") {
    return stageLayout(main, others, stage, gap, localCamera, input.pins);
  }

  /* --- 3. GRILLE CARRÉE -------------------------------------------- */

  // Deux tuiles et plus : une seule et même règle, sans exception. La grille
  // est calculée sur le côté du carré, pas sur un ratio cible — c'est ce qui
  // garantit des tuiles réellement carrées à toutes les tailles d'écran.
  const grid = bestSquareGrid(tiles.length, stage.w, stage.h, gap);
  const rects = placeGrid(tiles.length, stage.w, stage.h, gap, grid.cols, grid.side);

  return {
    mode: "grid",
    main: null,
    secondary: tiles.map((tile, i) => ({ tile, rect: offsetRect(rects[i], stage) })),
    selfView: null,
    strip: null,
    stripRect: null,
    stripScrolls: false,
    gap,
  };
}

function offsetRect(rect: LayoutRect, origin: LayoutRect): LayoutRect {
  return { x: origin.x + rect.x, y: origin.y + rect.y, w: rect.w, h: rect.h };
}

/**
 * MODE SCÈNE — un partage d'écran occupe la zone principale, les autres
 * participants sont répartis dans un bandeau.
 *
 * Le bandeau passe à droite en paysage, en bas en portrait. Sa taille est
 * calculée pour que les tuiles remplissent l'espace sans jamais descendre
 * sous une taille lisible ; au-delà, il défile.
 *
 * La caméra locale n'est PAS mise dans le bandeau : elle devient la vignette
 * flottante. C'est ce qui évite le double affichage constaté à l'audit.
 *
 * Les cellules du bandeau sont CARRÉES, comme partout ailleurs : un profil
 * participant ne change pas de forme selon l'endroit où il est rendu.
 */
function stageLayout(
  main: LayoutTile,
  others: LayoutTile[],
  stage: LayoutRect,
  gap: number,
  localCamera: LayoutTile | null,
  pins: LayoutInput["pins"]
): LayoutResult {
  const candidates = others.filter((t) => !(localCamera && t.id === localCamera.id));
  const selfViewTile = localCamera && localCamera.id !== main.id ? localCamera : null;

  /*
   * Ordre du bandeau — et non plus l'ordre brut de LiveKit. Voir `stripRank` :
   * le présentateur d'abord, puis les tuiles épinglées, puis les autres
   * partages, puis les caméras. L'ordre reste stable pour une même
   * composition, donc les tuiles ne « sautent » pas.
   */
  const stripTiles = orderStripTiles(main, candidates, pins);

  // Aucun secondaire : le partage occupe tout, la caméra locale flotte dessus.
  if (stripTiles.length === 0) {
    const mainRect = centeredBox(stage.w, stage.h, SCREEN_TILE_RATIO, 8);
    const absMain = offsetRect(mainRect, stage);
    return {
      mode: "stage",
      main: { tile: main, rect: absMain },
      secondary: [],
      selfView: selfViewTile ? { tile: selfViewTile, rect: selfViewRect(absMain) } : null,
      strip: null,
      stripRect: null,
      stripScrolls: false,
      gap,
    };
  }

  const useColumn = stage.w / stage.h >= COLUMN_STRIP_THRESHOLD;
  // Un partage d'écran dans le bandeau mérite plus de place qu'une caméra.
  const hasScreenShareInStrip = stripTiles.some((t) => t.source === "screenshare");
  const stripFraction = hasScreenShareInStrip ? 0.26 : 0.2;

  const mainRect: LayoutRect = { x: 0, y: 0, w: 0, h: 0 };
  const stripRect: LayoutRect = { x: 0, y: 0, w: 0, h: 0 };
  const slots: LayoutSlot[] = [];
  let stripScrolls = false;

  if (useColumn) {
    // --- Bandeau vertical à droite ---
    const idealSide = clamp(
      (stage.h - gap * (stripTiles.length - 1)) / stripTiles.length,
      MIN_TILE_SIDE,
      190
    );
    let stripW = clamp(idealSide, MIN_TILE_SIDE, stage.w * stripFraction);
    stripW = clamp(stripW, 96, Math.max(stage.w - MIN_TILE_W - gap, 96));

    const side = stripW;
    const visible = Math.max(Math.floor((stage.h + gap) / (side + gap)), 1);
    stripScrolls = stripTiles.length > visible;

    mainRect.w = Math.max(stage.w - stripW - gap, MIN_TILE_W);
    mainRect.h = stage.h;

    stripRect.x = mainRect.w + gap;
    stripRect.y = 0;
    stripRect.w = stripW;
    stripRect.h = stage.h;

    stripTiles.forEach((tile, i) => {
      const h = Math.min(side, stripRect.h);
      slots.push({
        tile,
        rect: {
          x: stripRect.x,
          y: stripRect.y + i * (side + gap),
          w: stripW,
          h,
        },
      });
    });
  } else {
    // --- Bandeau horizontal en bas ---
    const idealSide = clamp(
      (stage.w - gap * (stripTiles.length - 1)) / stripTiles.length,
      MIN_TILE_SIDE,
      240
    );
    let stripH = clamp(idealSide, MIN_TILE_SIDE, stage.h * stripFraction);

    const side = stripH;
    const visible = Math.max(Math.floor((stage.w + gap) / (side + gap)), 1);
    stripScrolls = stripTiles.length > visible;

    mainRect.w = stage.w;
    mainRect.h = Math.max(stage.h - stripH - gap, MIN_TILE_H);

    stripRect.x = 0;
    stripRect.y = mainRect.h + gap;
    stripRect.w = stage.w;
    stripRect.h = stripH;

    stripTiles.forEach((tile, i) => {
      slots.push({
        tile,
        rect: {
          x: stripRect.x + i * (side + gap),
          y: stripRect.y,
          w: Math.min(side, stripRect.w),
          h: stripH,
        },
      });
    });
  }

  const absMainRect = offsetRect(mainRect, stage);

  const secondary: LayoutSlot[] = slots.map((slot) => ({
    tile: slot.tile,
    rect: offsetRect(slot.rect, stage),
  }));

  // La vignette flottante se pose dans la zone principale, jamais sur le bandeau.
  const selfView = selfViewTile ? { tile: selfViewTile, rect: selfViewRect(absMainRect) } : null;

  return {
    mode: "stage",
    main: { tile: main, rect: absMainRect },
    secondary,
    selfView,
    strip: useColumn ? "column" : "row",
    stripRect: offsetRect(stripRect, stage),
    stripScrolls,
    gap,
  };
}

/**
 * MODE FOCUS — un PROFIL ÉPINGLÉ occupe la zone principale et fait environ
 * DEUX FOIS la taille d'une tuile du bandeau.
 *
 * Le facteur n'est pas une transformation CSS posée après coup : le moteur
 * réserve réellement `FOCUS_SCALE × s` de côté à la tuile épinglée et `s` à
 * chacune des autres. La composition entière (zone principale + bandeau) est
 * ensuite centrée dans l'espace mesuré, donc :
 *
 *  - rien ne se chevauche et rien ne déborde, quelle que soit la fenêtre ;
 *  - le profil épinglé reste CARRÉ (`mainSide` sert de largeur ET de hauteur) ;
 *  - le bandeau occupe tout l'axe perpendiculaire, ce qui lui permet
 *    d'afficher plusieurs tuiles sans les réduire.
 *
 * La caméra locale n'est PAS détournée en vignette flottante ici, contrairement
 * au mode « scène » : en focus, tous les profils — le sien compris — sont des
 * tuiles carrées du bandeau. La vignette flottante reste l'affichage propre au
 * partage d'écran.
 */
function focusLayout(
  main: LayoutTile,
  others: LayoutTile[],
  stage: LayoutRect,
  gap: number,
  pins: LayoutInput["pins"]
): LayoutResult {
  const stripTiles = orderStripTiles(main, others, pins);

  if (stripTiles.length === 0) {
    const rect = offsetRect(centeredBox(stage.w, stage.h, PARTICIPANT_TILE_RATIO, 8), stage);
    return {
      mode: "focus",
      main: { tile: main, rect },
      secondary: [],
      selfView: null,
      strip: null,
      stripRect: null,
      stripScrolls: false,
      gap,
    };
  }

  const useColumn = stage.w / stage.h >= COLUMN_STRIP_THRESHOLD;
  const keepVisible = Math.min(stripTiles.length, FOCUS_STRIP_MIN_VISIBLE);

  // Côté d'une tuile du bandeau. Trois bornes, dans l'ordre où elles mordent :
  //  1. la zone principale doit tenir — `FOCUS_SCALE × s` borné par l'axe
  //     principal de la scène ;
  //  2. la composition doit tenir dans l'axe transversal ;
  //  3. le bandeau doit rester lisible : au moins `keepVisible` tuiles visibles.
  const side = Math.max(
    MIN_TILE_SIDE,
    useColumn
      ? Math.min(
          stage.h / FOCUS_SCALE,
          (stage.w - gap) / (FOCUS_SCALE + 1),
          (stage.h - gap * (keepVisible - 1)) / keepVisible
        )
      : Math.min(
          stage.w / FOCUS_SCALE,
          (stage.h - gap) / (FOCUS_SCALE + 1),
          (stage.w - gap * (keepVisible - 1)) / keepVisible
        )
  );

  // Jamais plus grand que la scène : sur un écran très étroit, mieux vaut un
  // profil épinglé plus petit que prévu qu'une tuile qui déborde.
  const mainSide = useColumn
    ? Math.min(FOCUS_SCALE * side, stage.h, stage.w)
    : Math.min(FOCUS_SCALE * side, stage.w, stage.h);

  const mainRect: LayoutRect = { x: 0, y: 0, w: mainSide, h: mainSide };
  const stripRect: LayoutRect = { x: 0, y: 0, w: 0, h: 0 };

  if (useColumn) {
    const totalW = mainSide + gap + side;
    const originX = Math.max((stage.w - totalW) / 2, 0);

    mainRect.x = originX;
    mainRect.y = Math.max((stage.h - mainSide) / 2, 0);

    // Le bandeau occupe TOUTE la hauteur : c'est ce qui lui permet d'afficher
    // deux tuiles là où la hauteur de la zone principale n'en laisserait
    // qu'une.
    stripRect.x = originX + mainSide + gap;
    stripRect.y = 0;
    stripRect.w = side;
    stripRect.h = stage.h;
  } else {
    const totalH = mainSide + gap + side;
    const originY = Math.max((stage.h - totalH) / 2, 0);

    mainRect.y = originY;
    mainRect.x = Math.max((stage.w - mainSide) / 2, 0);

    stripRect.x = 0;
    stripRect.y = originY + mainSide + gap;
    stripRect.w = stage.w;
    stripRect.h = side;
  }

  const slots: LayoutSlot[] = stripTiles.map((tile, i) => ({
    tile,
    rect: useColumn
      ? { x: stripRect.x, y: stripRect.y + i * (side + gap), w: side, h: side }
      : { x: stripRect.x + i * (side + gap), y: stripRect.y, w: side, h: side },
  }));

  const capacity = useColumn
    ? Math.floor((stripRect.h + gap) / (side + gap))
    : Math.floor((stripRect.w + gap) / (side + gap));

  return {
    mode: "focus",
    main: { tile: main, rect: offsetRect(mainRect, stage) },
    secondary: slots.map((slot) => ({
      tile: slot.tile,
      rect: offsetRect(slot.rect, stage),
    })),
    selfView: null,
    strip: useColumn ? "column" : "row",
    stripRect: offsetRect(stripRect, stage),
    stripScrolls: stripTiles.length > capacity,
    gap,
  };
}

/* ------------------------------------------------------------------ */
/* Aide au rendu                                                       */
/* ------------------------------------------------------------------ */

/** Convertit un rectangle calculé en style inline React. */
export function rectToStyle(rect: LayoutRect): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
  };
}
