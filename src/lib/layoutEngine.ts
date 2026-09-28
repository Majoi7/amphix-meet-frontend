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
 * Règle de forme : toute tuile vidéo — caméra comme partage d'écran — est
 * calculée au ratio 16:9. Ce n'est pas une propriété CSS posée après coup : le
 * moteur choisit la PLUS GRANDE tuile 16:9 qui tient dans une cellule, donc une
 * vidéo n'est jamais déformée. L'espace qui reste est réparti AUTOUR de la
 * tuile, jamais dans sa forme.
 *
 * Quatre dispositions possibles, choisies par le moteur :
 *
 *  - `single` : une seule tuile, centrée ;
 *  - `grid`   : grille de tuiles 16:9 de taille égale ;
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
  /**
   * Tuile visée, quand elle est connue avec certitude.
   *
   * L'épingle GLOBALE vient de la base : elle ne connaît que
   * `(identité, source)` et reste donc sans `id`. Quand il est présent, il
   * tranche seul — un même participant peut publier DEUX partages d'écran
   * (le tableau blanc en publie un, sous `Track.Source.ScreenShare`), et
   * `(identité, source)` ne suffirait plus à désigner celui qui a été
   * épinglé.
   */
  id?: string;
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
    /**
     * Épingles locales, dans leur ordre de pose.
     *
     * La PREMIÈRE encore présente l'emporte sur la zone principale ; les
     * suivantes conservent une place privilégiée en tête du bandeau
     * secondaire (`stripRank`). Un tableau plutôt qu'une valeur unique : rien
     * n'interdit d'épingler deux intervenants, et le bandeau sait déjà les
     * ordonner.
     */
    local: LayoutPin[];
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
  /**
   * Composition retenue en mode `grid` — null dans les autres modes.
   *
   * Exposée pour rendre la décision du moteur vérifiable de l'extérieur :
   * c'est le résultat du score, pas une constante du code.
   */
  columns: number | null;
  rows: number | null;
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
 * Ratio cible d'une tuile vidéo : 16:9, pour une caméra COMME pour un partage
 * d'écran.
 *
 * Les deux sources partagent le même cadre parce que la forme ne dit pas
 * comment le contenu doit le remplir : une caméra est recadrée
 * (`object-cover`), un partage est inscrit sans perte (`object-contain`). Un
 * ratio unique garantit donc qu'aucune vidéo n'est déformée, sans jamais
 * rogner du contenu partagé.
 */
const TILE_RATIO = 16 / 9;

/**
 * Coût d'une case vide, exprimé en fraction de la surface d'une tuile.
 *
 * Maximiser la surface d'une tuile minimise déjà, à lui seul, l'espace perdu :
 * `marges + trous = surface du conteneur − count × surface d'une tuile`. Ce
 * terme ajoute ce que cette équivalence ne dit pas — un trou au milieu d'une
 * grille se voit plus qu'une marge. Sans lui, neuf participants se
 * répartiraient en 4 × 3 avec trois cases vides plutôt qu'en 3 × 3.
 */
const EMPTY_CELL_COST_RATIO = 0.35;

/** En dessous de cette largeur de tuile, le rendu devient illisible. */
const MIN_TILE_W = 120;
/** En dessous de cette hauteur de tuile, le rendu devient illisible. */
const MIN_TILE_H = 80;
/** Largeur maximale d'une cellule de bandeau secondaire. */
const STRIP_CELL_MAX_W = 240;
/** Taille maximale de la vignette caméra flottante. */
const SELF_VIEW_MAX_W = 280;
/** Taille minimale de la vignette caméra flottante. */
const SELF_VIEW_MIN_W = 132;

/** Marge intérieure appliquée autour des tuiles. */
const STAGE_PADDING = 8;

/** Au-delà de ce ratio largeur/hauteur, le bandeau secondaire passe à droite. */
const COLUMN_STRIP_THRESHOLD = 1.35;

/**
 * Rapport de taille visé, en mode « focus », entre la tuile ÉPINGLÉE et une
 * tuile du bandeau : la première doit faire environ deux fois la seconde.
 *
 * Ce n'est pas une transformation CSS : le moteur réserve réellement
 * `FOCUS_SCALE × c` de largeur à la tuile épinglée et `c` aux autres, chacune
 * au ratio 16:9. La géométrie est donc exacte, sans recouvrement ni
 * débordement.
 */
const FOCUS_SCALE = 2;

/**
 * Nombre de tuiles du bandeau qu'on cherche à garder visibles sans défiler en
 * mode « focus ».
 *
 * C'est ce qui borne la largeur `c` d'une cellule du bandeau — et donc, par
 * ricochet, la taille de la tuile épinglée : une tuile deux fois plus grande ne
 * sert à rien si les autres participants deviennent inatteignables. Au-delà, le
 * bandeau défile.
 */
const FOCUS_STRIP_MIN_VISIBLE = 2;

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Cette épingle désigne-t-elle cette tuile ?
 *
 * Règle UNIQUE, exportée : le rendu s'en sert pour marquer une tuile
 * « épinglée », le moteur pour élire la tuile principale. Deux
 * implémentations séparées finiraient par diverger, et l'écart se verrait
 * comme une épingle affichée sur une tuile qui n'est pas en zone principale.
 *
 * `id` l'emporte quand il est connu ; sinon on retombe sur le couple
 * `(identité, source)`, seule information que porte l'épingle globale.
 */
export function pinMatchesTile(pin: LayoutPin | null, tile: LayoutTile): boolean {
  if (!pin) return false;
  if (pin.id) return pin.id === tile.id;
  return pin.identity === tile.identity && pin.source === tile.source;
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
  if (
    pinMatchesTile(pins.global, tile) ||
    pins.local.some((pin) => pinMatchesTile(pin, tile))
  ) {
    return 1;
  }
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

  // Épingles locales : la PREMIÈRE posée encore présente l'emporte. L'ordre du
  // tableau est celui des épinglages, donc stable — une épingle dont le
  // participant a quitté la réunion ne correspond à aucune tuile et se saute
  // sans laisser de place vide.
  for (const pin of pins.local) {
    const localPinned = tiles.find((t) => pinMatchesTile(pin, t));
    if (localPinned) return localPinned;
  }

  // Le partage d'écran le plus récent (le dernier arrivé dans la liste).
  const screenShares = tiles.filter((t) => t.source === "screenshare");
  if (screenShares.length > 0) return screenShares[screenShares.length - 1];

  const speaking = tiles.find((t) => t.isSpeaking);
  if (speaking) return speaking;

  return tiles.reduce((oldest, t) => (t.arrivalIndex < oldest.arrivalIndex ? t : oldest), tiles[0]);
}

/**
 * Cherche la meilleure composition pour `count` tuiles dans une zone `w × h`.
 *
 * Chaque candidat est une grille `cols × ceil(count / cols)`. Pour chacun, la
 * tuile est le PLUS GRAND rectangle au ratio `ratio` qui tient dans une
 * cellule : sa forme est donc toujours la bonne, et l'espace qui ne peut pas
 * être occupé se retrouve autour d'elle, jamais dans sa déformation.
 *
 * Le score retient la tuile la plus grande, en retirant une fraction de sa
 * surface par case vide. Ce critère suffit parce que minimiser l'espace perdu
 * revient exactement à maximiser la surface d'une tuile :
 *
 *     marges + trous = surface du conteneur − count × surface d'une tuile
 *
 * Le terme de case vide ajoute ce que cette équivalence ne dit pas : un trou
 * au milieu d'une grille se voit plus qu'une marge.
 *
 * Parcourir `cols` de 1 à `count` suffit : `rows = ceil(count / cols)` prend
 * alors chaque valeur de 1 à `count`, donc aucune composition utile n'est
 * oubliée, sans double boucle. Le coût est linéaire en `count`.
 *
 * Le résultat ne dépend QUE de `count`, `w`, `h`, `gap` et `ratio` : la même
 * surface redonne toujours la même grille, et rien n'est codé par nombre de
 * participants.
 */
function bestGrid(
  count: number,
  w: number,
  h: number,
  gap: number,
  ratio: number
): { cols: number; rows: number; tileW: number; tileH: number } {
  let best: {
    cols: number;
    rows: number;
    tileW: number;
    tileH: number;
    score: number;
  } | null = null;

  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const cellW = (w - gap * (cols - 1)) / cols;
    const cellH = (h - gap * (rows - 1)) / rows;
    if (cellW <= 0 || cellH <= 0) continue;

    const tileW = Math.min(cellW, cellH * ratio);
    const tileH = tileW / ratio;
    const emptyRatio = (cols * rows - count) / count;
    const score = tileW * tileH * (1 - emptyRatio * EMPTY_CELL_COST_RATIO);

    if (!best || score > best.score) {
      best = { cols, rows, tileW, tileH, score };
    }
  }

  // Repli improbable (viewport dégénéré) : une seule colonne.
  if (!best) {
    const tileW = Math.max(w, 1);
    return { cols: 1, rows: count, tileW, tileH: Math.max(tileW / ratio, 1) };
  }
  return best;
}

/**
 * Place `count` cellules `tileW × tileH` dans une zone `w × h`.
 * Chaque rangée incomplète est centrée horizontalement — c'est ce qui
 * distingue une grille « moteur de layout » d'un `grid-cols-4` rigide, et ce
 * qui évite qu'une dernière rangée à une tuile se retrouve collée à gauche.
 */
function placeGrid(
  count: number,
  w: number,
  h: number,
  gap: number,
  cols: number,
  tileW: number,
  tileH: number
): LayoutRect[] {
  const rows = Math.ceil(count / cols);
  const totalH = rows * tileH + (rows - 1) * gap;
  const offsetY = Math.max((h - totalH) / 2, 0);

  const rects: LayoutRect[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = Math.min(cols, count - row * cols);
    const rowW = inRow * tileW + (inRow - 1) * gap;
    const offsetX = Math.max((w - rowW) / 2, 0);

    rects.push({
      x: offsetX + col * (tileW + gap),
      y: offsetY + row * (tileH + gap),
      w: tileW,
      h: tileH,
    });
  }
  return rects;
}

/** Plus grand rectangle au ratio demandé, centré dans une zone, avec marge. */
function centeredBox(w: number, h: number, ratio: number, padding: number): LayoutRect {
  const availW = Math.max(w - padding * 2, 1);
  const availH = Math.max(h - padding * 2, 1);

  // Aucun plafond de largeur : une réunion à une personne, ou un partage
  // d'écran seul, doit occuper la surface disponible. C'est le ratio qui borne
  // la taille, jamais une constante arbitraire.
  let boxW = availW;
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

/**
 * Vignette flottante ancrée en bas à droite d'une zone, sans jamais déborder.
 *
 * Elle est au MÊME ratio que toutes les autres tuiles : c'est la caméra locale,
 * et une caméra ne change pas de forme selon l'endroit où elle est dessinée.
 * Un ratio propre à la vignette aurait rendu faux l'invariant du moteur — toute
 * tuile vidéo est calculée au ratio `TILE_RATIO` — pour un gain nul.
 */
function selfViewRect(within: LayoutRect): LayoutRect {
  const margin = 16;
  let boxW = clamp(within.w * 0.18, SELF_VIEW_MIN_W, SELF_VIEW_MAX_W);
  let boxH = boxW / TILE_RATIO;

  const maxH = within.h * 0.45;
  if (boxH > maxH) {
    boxH = maxH;
    boxW = boxH * TILE_RATIO;
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
    columns: null,
    rows: null,
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

  const visibleTiles = localScreenShareActive
    ? input.tiles.filter((t) => !(t.isLocal && t.source === "camera"))
    : input.tiles;

  // Ordre STABLE : c'est lui qui décide qui occupe quelle cellule. Sans lui,
  // l'ordre rendu par LiveKit — qui peut changer quand une piste est
  // republiée — ferait sauter les tuiles d'une place à l'autre sans qu'aucun
  // participant ne soit entré ni sorti. `arrivalIndex` ne bouge jamais pendant
  // la réunion : la copie évite de trier le tableau de l'appelant.
  const tiles = [...visibleTiles].sort((a, b) => a.arrivalIndex - b.arrivalIndex);

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
    (pinMatchesTile(input.pins.global, main) ||
      input.pins.local.some((pin) => pinMatchesTile(pin, main)));

  /* --- 2. MODE ----------------------------------------------------- */

  // Une seule tuile : centrée, et la plus grande possible au ratio 16:9. Une
  // réunion à une personne n'a aucune raison de s'afficher dans un carré : le
  // ratio borne la taille, il ne réduit pas la surface utilisée.
  if (tiles.length === 1) {
    const rect = centeredBox(stage.w, stage.h, TILE_RATIO, 8);
    return {
      mode: "single",
      columns: null,
      rows: null,
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
  // un partage d'écran. Si une épingle y a placé une caméra alors qu'un partage
  // existe ailleurs, on retombe sur la grille : réserver une immense zone
  // principale à une caméra pendant qu'un partage est réduit à une vignette
  // inverserait la priorité — le contenu partagé est ce qu'on est venu voir.
  if (hasScreenShare && main && main.source === "screenshare") {
    return stageLayout(main, others, stage, gap, localCamera, input.pins);
  }

  /* --- 3. GRILLE 16:9 ---------------------------------------------- */

  // Deux tuiles et plus : une seule et même règle, sans exception. La
  // composition (colonnes × rangées) n'est jamais déduite du nombre de
  // participants : elle sort du score de `bestGrid`, calculé sur la surface
  // réellement mesurée. Une même réunion peut donc donner 2 × 2 sur un écran
  // large et 3 × 1 sur un écran bas, sans qu'aucune ligne ne le prévoie.
  const grid = bestGrid(tiles.length, stage.w, stage.h, gap, TILE_RATIO);
  const rects = placeGrid(
    tiles.length,
    stage.w,
    stage.h,
    gap,
    grid.cols,
    grid.tileW,
    grid.tileH
  );

  return {
    mode: "grid",
    columns: grid.cols,
    rows: grid.rows,
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
 * Les cellules du bandeau sont au même ratio 16:9 que partout ailleurs : une
 * tuile ne change pas de forme selon l'endroit où elle est rendue. C'est ce qui
 * permet à un SECOND partage d'écran d'être lisible dans le bandeau, au lieu
 * d'être écrasé dans un carré où son contenu se perdait entre deux bandes
 * vides.
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
    const mainRect = centeredBox(stage.w, stage.h, TILE_RATIO, 8);
    const absMain = offsetRect(mainRect, stage);
    return {
      mode: "stage",
      columns: null,
      rows: null,
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
    // Largeur de cellule qui permettrait de tout afficher sans défiler, bornée
    // pour rester une vignette et ne jamais devenir une seconde zone
    // principale. La hauteur en découle : la cellule est au ratio 16:9, donc un
    // partage d'écran y tient sans bandes noires, comme n'importe quelle caméra.
    const idealCellW =
      ((stage.h - gap * (stripTiles.length - 1)) / stripTiles.length) * TILE_RATIO;
    let stripW = clamp(idealCellW, MIN_TILE_W, STRIP_CELL_MAX_W);
    stripW = clamp(stripW, MIN_TILE_W, Math.max(stage.w * stripFraction, MIN_TILE_W));
    stripW = clamp(stripW, MIN_TILE_W, Math.max(stage.w - MIN_TILE_W - gap, MIN_TILE_W));

    const cellH = stripW / TILE_RATIO;
    const visible = Math.max(Math.floor((stage.h + gap) / (cellH + gap)), 1);
    stripScrolls = stripTiles.length > visible;

    mainRect.w = Math.max(stage.w - stripW - gap, MIN_TILE_W);
    mainRect.h = stage.h;

    stripRect.x = mainRect.w + gap;
    stripRect.y = 0;
    stripRect.w = stripW;
    stripRect.h = stage.h;

    stripTiles.forEach((tile, i) => {
      slots.push({
        tile,
        rect: {
          x: stripRect.x,
          y: stripRect.y + i * (cellH + gap),
          w: stripW,
          h: Math.min(cellH, stripRect.h),
        },
      });
    });
  } else {
    // --- Bandeau horizontal en bas ---
    const idealCellH =
      (stage.w - gap * (stripTiles.length - 1)) / stripTiles.length / TILE_RATIO;
    let stripH = clamp(idealCellH, MIN_TILE_H, STRIP_CELL_MAX_W / TILE_RATIO);
    stripH = clamp(stripH, MIN_TILE_H, Math.max(stage.h * stripFraction, MIN_TILE_H));

    const cellW = stripH * TILE_RATIO;
    const visible = Math.max(Math.floor((stage.w + gap) / (cellW + gap)), 1);
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
          x: stripRect.x + i * (cellW + gap),
          y: stripRect.y,
          w: Math.min(cellW, stripRect.w),
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
    columns: null,
    rows: null,
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
 * réserve réellement `FOCUS_SCALE × c` de largeur à la tuile épinglée et `c` à
 * chacune des autres, `c` étant la largeur d'une cellule du bandeau. La
 * composition entière (zone principale + bandeau) est ensuite centrée dans
 * l'espace mesuré, donc :
 *
 *  - rien ne se chevauche et rien ne déborde, quelle que soit la fenêtre ;
 *  - la tuile épinglée est au ratio 16:9 comme toutes les autres — elle est
 *    plus GRANDE, jamais d'une autre forme ;
 *  - le bandeau occupe tout l'axe perpendiculaire, ce qui lui permet
 *    d'afficher plusieurs tuiles sans les réduire.
 *
 * La caméra locale n'est PAS détournée en vignette flottante ici, contrairement
 * au mode « scène » : en focus, tous les profils — le sien compris — sont des
 * tuiles du bandeau. La vignette flottante reste l'affichage propre au partage
 * d'écran.
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
    const rect = offsetRect(centeredBox(stage.w, stage.h, TILE_RATIO, 8), stage);
    return {
      mode: "focus",
      columns: null,
      rows: null,
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

  // Largeur `c` d'une tuile du bandeau — sa hauteur en découle (`c / ratio`).
  // Trois bornes, dans l'ordre où elles mordent :
  //  1. la zone principale doit tenir : `FOCUS_SCALE × c` de large et
  //     `FOCUS_SCALE × c / ratio` de haut ;
  //  2. la composition entière doit tenir dans l'axe transversal ;
  //  3. le bandeau doit rester lisible : au moins `keepVisible` tuiles visibles.
  const side = Math.max(
    MIN_TILE_W,
    useColumn
      ? Math.min(
          (stage.h * TILE_RATIO) / FOCUS_SCALE,
          (stage.w - gap) / (FOCUS_SCALE + 1),
          (TILE_RATIO * (stage.h - gap * (keepVisible - 1))) / keepVisible
        )
      : Math.min(
          stage.w / FOCUS_SCALE,
          (TILE_RATIO * (stage.h - gap)) / (FOCUS_SCALE + 1),
          (stage.w - gap * (keepVisible - 1)) / keepVisible
        )
  );

  const cellW = side;
  const cellH = side / TILE_RATIO;

  // Jamais plus grand que la scène : sur un écran très étroit, mieux vaut une
  // tuile épinglée plus petite que prévu qu'une tuile qui déborde. La largeur
  // est bornée par les DEUX axes et la hauteur en découle — le ratio 16:9 est
  // donc préservé jusque dans ce repli.
  const mainW = Math.min(FOCUS_SCALE * cellW, stage.w, stage.h * TILE_RATIO);
  const mainH = mainW / TILE_RATIO;

  const mainRect: LayoutRect = { x: 0, y: 0, w: mainW, h: mainH };
  const stripRect: LayoutRect = { x: 0, y: 0, w: 0, h: 0 };

  if (useColumn) {
    const totalW = mainW + gap + cellW;
    const originX = Math.max((stage.w - totalW) / 2, 0);

    mainRect.x = originX;
    mainRect.y = Math.max((stage.h - mainH) / 2, 0);

    // Le bandeau occupe TOUTE la hauteur : c'est ce qui lui permet d'afficher
    // deux tuiles là où la hauteur de la zone principale n'en laisserait
    // qu'une.
    stripRect.x = originX + mainW + gap;
    stripRect.y = 0;
    stripRect.w = cellW;
    stripRect.h = stage.h;
  } else {
    const totalH = mainH + gap + cellH;
    const originY = Math.max((stage.h - totalH) / 2, 0);

    mainRect.y = originY;
    mainRect.x = Math.max((stage.w - mainW) / 2, 0);

    stripRect.x = 0;
    stripRect.y = originY + mainH + gap;
    stripRect.w = stage.w;
    stripRect.h = cellH;
  }

  const slots: LayoutSlot[] = stripTiles.map((tile, i) => ({
    tile,
    rect: useColumn
      ? {
          x: stripRect.x,
          y: stripRect.y + i * (cellH + gap),
          w: cellW,
          h: Math.min(cellH, stripRect.h),
        }
      : {
          x: stripRect.x + i * (cellW + gap),
          y: stripRect.y,
          w: Math.min(cellW, stripRect.w),
          h: cellH,
        },
  }));

  const capacity = useColumn
    ? Math.floor((stripRect.h + gap) / (cellH + gap))
    : Math.floor((stripRect.w + gap) / (cellW + gap));

  return {
    mode: "focus",
    columns: null,
    rows: null,
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
