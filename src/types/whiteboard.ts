export interface WhiteboardPoint {
  /** Coordonnées "monde" du canvas infini — indépendantes du zoom/pan de
   * chaque participant (avant : normalisé 0..1 par rapport au conteneur). */
  x: number;
  y: number;
}

export type WhiteboardTool =
  | "pencil"
  | "eraser"
  | "line"
  | "rectangle"
  | "circle"
  | "function"
  | "select"
  | "pan";

export interface WhiteboardStroke {
  id: string;
  authorId: string;
  tool: WhiteboardTool;
  color: string;
  width: number;
  points: WhiteboardPoint[];
}

/** version 2 = coordonnées monde (canvas infini). Absence de `version`
 * = ancien format normalisé 0..1, à convertir une fois au chargement. */
export interface WhiteboardData {
  version?: 2;
  strokes: WhiteboardStroke[];
}

export interface WhiteboardCamera {
  x: number;
  y: number;
  zoom: number;
}

/** Dimensions "monde" occupées par l'ancien format normalisé 0..1 —
 * sert uniquement à convertir les anciens tableaux sauvegardés. */
export const WHITEBOARD_LEGACY_WIDTH = 1600;
export const WHITEBOARD_LEGACY_HEIGHT = 900;