export interface WhiteboardPoint {
  x: number; // normalisé 0..1 (indépendant de la taille d'écran du client)
  y: number;
}

export type WhiteboardTool = "pencil" | "eraser" | "line" | "rectangle" | "circle" | "function";

export interface WhiteboardStroke {
  id: string;
  authorId: string;
  tool: WhiteboardTool;
  color: string;
  width: number;
  points: WhiteboardPoint[];
}

export interface WhiteboardData {
  strokes: WhiteboardStroke[];
}
