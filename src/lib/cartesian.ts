import { compileExpression } from "./mathExpression";
import type { WhiteboardPoint, WhiteboardStroke } from "../types/whiteboard";

export interface MathViewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export const DEFAULT_VIEWPORT: MathViewport = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };

const SAMPLE_COUNT = 300;

function toNormalized(x: number, y: number, viewport: MathViewport): WhiteboardPoint {
  return {
    x: (x - viewport.xMin) / (viewport.xMax - viewport.xMin),
    y: 1 - (y - viewport.yMin) / (viewport.yMax - viewport.yMin),
  };
}

/**
 * Échantillonne f(x) sur [xMin, xMax] et renvoie un ou plusieurs SEGMENTS
 * de points normalisés — plusieurs segments si la fonction a des points
 * indéfinis ou hors-cadre (division par zéro, racine négative, asymptote
 * verticale...), pour ne pas relier artificiellement deux branches
 * disjointes par une ligne droite.
 */
export function sampleFunction(expression: string, viewport: MathViewport): WhiteboardPoint[][] {
  const fn = compileExpression(expression);
  const segments: WhiteboardPoint[][] = [];
  let current: WhiteboardPoint[] = [];
  const yRange = viewport.yMax - viewport.yMin;

  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const x = viewport.xMin + ((viewport.xMax - viewport.xMin) * i) / SAMPLE_COUNT;
    const y = fn(x);
    const outOfRange = y < viewport.yMin - yRange || y > viewport.yMax + yRange;

    if (!Number.isFinite(y) || outOfRange) {
      if (current.length > 1) segments.push(current);
      current = [];
      continue;
    }
    current.push(toNormalized(x, y, viewport));
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

/** Construit les deux traits représentant les axes x et y du repère. */
export function buildAxisStrokes(viewport: MathViewport, authorId: string): WhiteboardStroke[] {
  const axisColor = "#5f6368";
  const xAxis: WhiteboardStroke = {
    id: crypto.randomUUID(),
    authorId,
    tool: "line",
    color: axisColor,
    width: 1.5,
    points: [toNormalized(viewport.xMin, 0, viewport), toNormalized(viewport.xMax, 0, viewport)],
  };
  const yAxis: WhiteboardStroke = {
    id: crypto.randomUUID(),
    authorId,
    tool: "line",
    color: axisColor,
    width: 1.5,
    points: [toNormalized(0, viewport.yMin, viewport), toNormalized(0, viewport.yMax, viewport)],
  };
  return [xAxis, yAxis];
}
