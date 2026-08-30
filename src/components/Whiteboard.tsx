import { useCallback, useEffect, useRef, useState } from "react";
import {
  Circle as CircleIcon,
  Eraser,
  Minus,
  Pencil,
  Redo2,
  Sigma,
  Square,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useDataChannel, useLocalParticipant } from "@livekit/components-react";
import { getWhiteboard, saveWhiteboard } from "../lib/whiteboardApi";
import { MathPanel } from "./MathPanel";
import type {
  WhiteboardPoint,
  WhiteboardStroke,
  WhiteboardTool,
} from "../types/whiteboard";

interface WhiteboardProps {
  roomId: string;
  isHost: boolean;
  onClose: () => void;
}

const CANVAS_BG = "#1f2536";
const COLORS = ["#e8eaed", "#ea4335", "#fbbc04", "#34a853", "#8ab4f8", "#c58af9"];
const WIDTHS = [2, 5, 10];
const DATA_TOPIC = "whiteboard";
const SAVE_DEBOUNCE_MS = 1200;

type WhiteboardMessage =
  | { type: "stroke"; stroke: WhiteboardStroke }
  | { type: "remove"; strokeId: string }
  | { type: "clear" };

/**
 * Tableau blanc collaboratif. Synchronisation temps réel via le canal de
 * données LiveKit (chaque trait terminé est diffusé à tous les
 * participants) — pas d'infra WebSocket séparée. La persistance en base
 * (whiteboardApi) est un filet de sécurité : elle permet à quelqu'un qui
 * rejoint en retard ou recharge la page de retrouver l'état actuel, mais
 * la sync en direct entre gens déjà connectés ne passe PAS par elle.
 *
 * Undo/redo est volontairement limité à SES PROPRES traits (pas de
 * vrai historique collaboratif type CRDT) — annuler le trait de
 * quelqu'un d'autre n'est pas supporté.
 */
export function Whiteboard({ roomId, isHost, onClose }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { localParticipant } = useLocalParticipant();

  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [tool, setTool] = useState<WhiteboardTool>("pencil");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isMathPanelOpen, setIsMathPanelOpen] = useState(false);
  const currentStrokeRef = useRef<WhiteboardStroke | null>(null);
  const [, forceRender] = useState(0);

  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<WhiteboardStroke[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { send } = useDataChannel(DATA_TOPIC, (msg) => {
    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.payload)) as WhiteboardMessage;
      if (payload.type === "stroke") {
        setStrokes((prev) =>
          prev.some((s) => s.id === payload.stroke.id) ? prev : [...prev, payload.stroke]
        );
      } else if (payload.type === "remove") {
        setStrokes((prev) => prev.filter((s) => s.id !== payload.strokeId));
      } else if (payload.type === "clear") {
        setStrokes([]);
      }
    } catch {
      /* message malformé — ignoré */
    }
  });

  function broadcast(message: WhiteboardMessage) {
    send(new TextEncoder().encode(JSON.stringify(message)), { reliable: true });
  }

  // Chargement de l'état existant à l'ouverture du tableau.
  useEffect(() => {
    getWhiteboard(roomId)
      .then((res) => setStrokes(res.data.strokes ?? []))
      .catch(() => {
        /* silencieux — on part d'un tableau vide */
      });
  }, [roomId]);

  const scheduleSave = useCallback(
    (nextStrokes: WhiteboardStroke[]) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveWhiteboard(roomId, { strokes: nextStrokes }).catch(() => {
          /* silencieux — la sync temps réel reste fonctionnelle même si la sauvegarde échoue */
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [roomId]
  );

  useEffect(() => {
    scheduleSave(strokes);
  }, [strokes, scheduleSave]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const allStrokes = currentStrokeRef.current ? [...strokes, currentStrokeRef.current] : strokes;
    for (const stroke of allStrokes) {
      drawStroke(ctx, stroke, canvas.width, canvas.height);
    }
  }, [strokes]);

  // Redessine à chaque rendu (déclenché par setStrokes ou forceRender pendant le tracé en cours).
  useEffect(() => {
    draw();
  });

  // Garde le canvas net (pas flou/étiré) en le redimensionnant au conteneur.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    function resize() {
      const rect = container!.getBoundingClientRect();
      canvas!.width = rect.width;
      canvas!.height = rect.height;
      draw();
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  function getNormalizedPoint(e: React.PointerEvent<HTMLCanvasElement>): WhiteboardPoint {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = getNormalizedPoint(e);
    currentStrokeRef.current = {
      id: crypto.randomUUID(),
      authorId: localParticipant.identity,
      tool,
      color: tool === "eraser" ? CANVAS_BG : color,
      width: tool === "eraser" ? width * 4 : width,
      points: [point],
    };
    setIsDrawing(true);
    forceRender((n) => n + 1);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing || !currentStrokeRef.current) return;
    const point = getNormalizedPoint(e);
    const stroke = currentStrokeRef.current;

    if (stroke.tool === "pencil" || stroke.tool === "eraser") {
      stroke.points.push(point);
    } else {
      // ligne/rectangle/cercle : seuls le point de départ et le point courant comptent
      stroke.points = [stroke.points[0], point];
    }
    draw();
  }

  /** Ajoute un ou plusieurs traits d'un coup — utilisé par le dessin
   * normal (1 trait) et par le panneau maths (plusieurs segments d'une
   * même fonction, ou les 2 traits des axes). */
  function commitStrokes(newStrokes: WhiteboardStroke[]) {
    if (newStrokes.length === 0) return;
    setStrokes((prev) => [...prev, ...newStrokes]);
    for (const s of newStrokes) {
      undoStackRef.current.push(s.id);
      broadcast({ type: "stroke", stroke: s });
    }
    redoStackRef.current = [];
  }

  function handlePointerUp() {
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    setIsDrawing(false);
    if (!stroke) return;

    const isShapeTool = stroke.tool !== "pencil" && stroke.tool !== "eraser";
    if (isShapeTool && stroke.points.length < 2) return; // clic sans glisser — ignoré

    commitStrokes([stroke]);
  }

  function handleUndo() {
    const lastId = undoStackRef.current.pop();
    if (!lastId) return;
    const stroke = strokes.find((s) => s.id === lastId);
    if (!stroke) return;
    redoStackRef.current.push(stroke);
    setStrokes((prev) => prev.filter((s) => s.id !== lastId));
    broadcast({ type: "remove", strokeId: lastId });
  }

  function handleRedo() {
    const stroke = redoStackRef.current.pop();
    if (!stroke) return;
    undoStackRef.current.push(stroke.id);
    setStrokes((prev) => [...prev, stroke]);
    broadcast({ type: "stroke", stroke });
  }

  function handleClear() {
    setStrokes([]);
    undoStackRef.current = [];
    redoStackRef.current = [];
    broadcast({ type: "clear" });
  }

  return (
    <div className="flex h-full w-full flex-col" style={{ backgroundColor: CANVAS_BG }}>
      <div className="flex flex-wrap items-center gap-2 border-b border-meet-border bg-meet-bg-secondary px-3 py-2">
        <ToolButton active={tool === "pencil"} onClick={() => setTool("pencil")} label="Crayon">
          <Pencil size={16} />
        </ToolButton>
        <ToolButton active={tool === "eraser"} onClick={() => setTool("eraser")} label="Gomme">
          <Eraser size={16} />
        </ToolButton>
        <ToolButton active={tool === "line"} onClick={() => setTool("line")} label="Ligne">
          <Minus size={16} />
        </ToolButton>
        <ToolButton
          active={tool === "rectangle"}
          onClick={() => setTool("rectangle")}
          label="Rectangle"
        >
          <Square size={16} />
        </ToolButton>
        <ToolButton active={tool === "circle"} onClick={() => setTool("circle")} label="Cercle">
          <CircleIcon size={16} />
        </ToolButton>
        <ToolButton
          active={isMathPanelOpen}
          onClick={() => setIsMathPanelOpen((v) => !v)}
          label="Fonction f(x)"
        >
          <Sigma size={16} />
        </ToolButton>

        <div className="mx-1 h-6 w-px bg-meet-border" />

        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Couleur ${c}`}
            className={`h-6 w-6 flex-shrink-0 rounded-full ring-2 transition-transform ${
              color === c ? "scale-110 ring-meet-text-primary" : "ring-transparent"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}

        <div className="mx-1 h-6 w-px bg-meet-border" />

        {WIDTHS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWidth(w)}
            aria-label={`Épaisseur ${w}`}
            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
              width === w ? "bg-meet-control" : ""
            }`}
          >
            <span
              className="rounded-full bg-meet-text-primary"
              style={{ width: w + 2, height: w + 2 }}
            />
          </button>
        ))}

        <div className="mx-1 h-6 w-px bg-meet-border" />

        <ToolButton onClick={handleUndo} label="Annuler mon dernier trait">
          <Undo2 size={16} />
        </ToolButton>
        <ToolButton onClick={handleRedo} label="Rétablir">
          <Redo2 size={16} />
        </ToolButton>
        {isHost && (
          <ToolButton onClick={handleClear} label="Tout effacer">
            <Trash2 size={16} />
          </ToolButton>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le tableau blanc"
          className="ml-auto flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-meet-text-secondary hover:bg-meet-control hover:text-meet-text-primary"
        >
          <X size={18} />
        </button>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1">
        {isMathPanelOpen && (
          <MathPanel
            authorId={localParticipant.identity}
            color={color}
            width={width}
            onPlot={(newStrokes) => commitStrokes(newStrokes)}
            onClose={() => setIsMathPanelOpen(false)}
          />
        )}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="absolute inset-0 h-full w-full touch-none"
        />
      </div>
    </div>
  );
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: WhiteboardStroke,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (stroke.points.length === 0) return;
  const toPixel = (p: WhiteboardPoint) => ({ x: p.x * canvasWidth, y: p.y * canvasHeight });

  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.tool === "pencil" || stroke.tool === "eraser" || stroke.tool === "function") {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    const start = toPixel(stroke.points[0]);
    ctx.moveTo(start.x, start.y);
    for (const p of stroke.points.slice(1)) {
      const px = toPixel(p);
      ctx.lineTo(px.x, px.y);
    }
    ctx.stroke();
    return;
  }

  if (stroke.points.length < 2) return;
  const a = toPixel(stroke.points[0]);
  const b = toPixel(stroke.points[stroke.points.length - 1]);

  if (stroke.tool === "line") {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  } else if (stroke.tool === "rectangle") {
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  } else if (stroke.tool === "circle") {
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const rx = Math.abs(b.x - a.x) / 2;
    const ry = Math.abs(b.y - a.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function ToolButton({
  children,
  active,
  onClick,
  label,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
        active
          ? "bg-meet-blue text-meet-bg"
          : "text-meet-text-secondary hover:bg-meet-control hover:text-meet-text-primary"
      }`}
    >
      {children}
    </button>
  );
}
