import { useCallback, useEffect, useRef, useState } from "react";
import {
  Circle as CircleIcon,
  Eraser,
  Eye,
  EyeOff,
  Hand,
  LocateFixed,
  Minus,
  MousePointer2,
  Pencil,
  Redo2,
  Sigma,
  Share2,
  Square,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useDataChannel, useLocalParticipant } from "@livekit/components-react";
import { getWhiteboard, saveWhiteboard } from "../lib/whiteboardApi";
import { MathPanel } from "./MathPanel";
import type {
  WhiteboardCamera,
  WhiteboardPoint,
  WhiteboardStroke,
  WhiteboardTool,
} from "../types/whiteboard";
import { WHITEBOARD_LEGACY_HEIGHT, WHITEBOARD_LEGACY_WIDTH } from "../types/whiteboard";
import { Track } from "livekit-client";

interface WhiteboardProps {
  roomId: string;
  isHost: boolean;
  onClose: () => void;
}

const CANVAS_BG = "#ffffff";
const COLORS = ["#212529", "#ea4335", "#fbbc04", "#34a853", "#8ab4f8", "#c58af9"];
const WIDTHS = [2, 5, 10];
const DATA_TOPIC = "whiteboard";
const SAVE_DEBOUNCE_MS = 1200;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const DEFAULT_CAMERA: WhiteboardCamera = { x: 0, y: 0, zoom: 1 };

type WhiteboardMessage =
  | { type: "stroke"; stroke: WhiteboardStroke }
  | { type: "update"; stroke: WhiteboardStroke }
  | { type: "remove"; strokeId: string }
  | { type: "clear" };

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function screenToWorld(p: { x: number; y: number }, camera: WhiteboardCamera): WhiteboardPoint {
  return { x: p.x / camera.zoom + camera.x, y: p.y / camera.zoom + camera.y };
}

function getStrokeBounds(stroke: WhiteboardStroke) {
  const xs = stroke.points.map((p) => p.x);
  const ys = stroke.points.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function boundsIntersect(
  a: { minX: number; maxX: number; minY: number; maxY: number },
  b: { minX: number; maxX: number; minY: number; maxY: number }
): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/**
 * Tableau blanc collaboratif — canvas infini (pan/zoom façon Lorien),
 * outil de sélection (déplacer/supprimer), mode zen.
 *
 * Coordonnées : les traits sont stockés en coordonnées "monde", pas en
 * pixels écran — chaque participant a sa propre caméra (position + zoom)
 * locale, non synchronisée, comme dans Lorien. Ce qui est synchronisé,
 * c'est le contenu (les traits), pas le point de vue de chacun.
 *
 * Undo/redo reste limité à SES PROPRES traits (pas de CRDT).
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
  const [camera, setCamera] = useState<WhiteboardCamera>(DEFAULT_CAMERA);
  const [isZen, setIsZen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSharing, setIsSharing] = useState(false);
  const [shareStream, setShareStream] = useState<MediaStream | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const toggleShareScreen = useCallback(async () => {
    // Prevent multiple clicks while publishing
    if (isPublishing) return;

    if (isSharing) {
      // Stop sharing
      try {
        if (shareStream) {
          // First unpublish the track from LiveKit
          const track = shareStream.getVideoTracks()[0];
          if (track && localParticipant) {
            await localParticipant.unpublishTrack(track);
          }
          // Then stop all tracks
          shareStream.getTracks().forEach(track => track.stop());
          setShareStream(null);
        }
      } catch (err) {
        console.error('Error stopping share:', err);
      } finally {
        setIsSharing(false);
        setIsPublishing(false);
      }
    } else {
      // Start sharing
      setIsPublishing(true);
      try {
        // Verify canvas exists and has valid dimensions
        const canvas = canvasRef.current;
        if (!canvas) {
          console.error('No canvas available for capture');
          return;
        }

        if (canvas.width === 0 || canvas.height === 0) {
          console.error('Canvas has invalid dimensions:', canvas.width, 'x', canvas.height);
          return;
        }

        const stream = canvas.captureStream(30);
        if (!stream) {
          console.error('No canvas available for capture');
          return;
        }

        const track = stream.getVideoTracks()[0];
        if (!track) {
          console.error('No video track from canvas');
          return;
        }

        // Publish the track
        if (localParticipant) {
          await localParticipant.publishTrack(track, {
            source: Track.Source.ScreenShare,
            name: 'whiteboard'
          });
          setShareStream(stream);
          setIsSharing(true);
        } else {
          console.error('No local participant available');
        }
      } catch (err) {
        console.error('Failed to share screen:', err);
      } finally {
        setIsPublishing(false);
      }
    }
  }, [isSharing, shareStream, localParticipant, isPublishing]);

  useEffect(() => {
    return () => {
      if (shareStream) {
        try {
          // Unpublish track before stopping
          const track = shareStream.getVideoTracks()[0];
          if (track && localParticipant) {
            localParticipant.unpublishTrack(track).catch(err =>
              console.error('Error unpublishing track on cleanup:', err)
            );
          }
        } catch (err) {
          console.error('Error in cleanup unpublish:', err);
        }
        // Stop all tracks
        shareStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [shareStream, localParticipant]);

  const currentStrokeRef = useRef<WhiteboardStroke | null>(null);
  const marqueeRef = useRef<{ start: WhiteboardPoint; current: WhiteboardPoint } | null>(null);
  const panStartRef = useRef<{ screen: WhiteboardPoint; camera: WhiteboardCamera } | null>(null);
  const moveDragRef = useRef<{ startWorld: WhiteboardPoint; offset: WhiteboardPoint } | null>(null);
  const [, forceRender] = useState(0);

  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<WhiteboardStroke[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDrawingTool = tool === "pencil" || tool === "eraser" || tool === "line" || tool === "rectangle" || tool === "circle";

  const { send } = useDataChannel(DATA_TOPIC, (msg) => {
    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.payload)) as WhiteboardMessage;
      if (payload.type === "stroke") {
        setStrokes((prev) =>
          prev.some((s) => s.id === payload.stroke.id) ? prev : [...prev, payload.stroke]
        );
      } else if (payload.type === "update") {
        setStrokes((prev) => prev.map((s) => (s.id === payload.stroke.id ? payload.stroke : s)));
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

  // Chargement + conversion des anciennes données (normalisé 0..1 → monde).
  useEffect(() => {
    getWhiteboard(roomId)
      .then((res) => {
        const data = res.data;
        const isLegacy = data.version !== 2;
        const loaded = (data.strokes ?? []).map((s) =>
          isLegacy
            ? { ...s, points: s.points.map((p) => ({ x: p.x * WHITEBOARD_LEGACY_WIDTH, y: p.y * WHITEBOARD_LEGACY_HEIGHT })) }
            : s
        );
        setStrokes(loaded);
      })
      .catch(() => {
        /* silencieux — on part d'un tableau vide */
      });
  }, [roomId]);

  const scheduleSave = useCallback(
    (nextStrokes: WhiteboardStroke[]) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveWhiteboard(roomId, { version: 2, strokes: nextStrokes }).catch(() => {
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

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw notebook lines background
    drawNotebookLines(ctx, camera, canvas.width, canvas.height);

    ctx.setTransform(camera.zoom, 0, 0, camera.zoom, -camera.x * camera.zoom, -camera.y * camera.zoom);

    const dragOffset = moveDragRef.current?.offset;
    const allStrokes = currentStrokeRef.current ? [...strokes, currentStrokeRef.current] : strokes;

    for (const stroke of allStrokes) {
      const isDragged = dragOffset && selectedIds.has(stroke.id);
      const drawn = isDragged
        ? { ...stroke, points: stroke.points.map((p) => ({ x: p.x + dragOffset.x, y: p.y + dragOffset.y })) }
        : stroke;
      drawStroke(ctx, drawn);
    }

    // Surbrillance des traits sélectionnés
    if (selectedIds.size > 0) {
      ctx.save();
      ctx.strokeStyle = "#8ab4f8";
      ctx.lineWidth = 1.5 / camera.zoom;
      ctx.setLineDash([6 / camera.zoom, 4 / camera.zoom]);
      for (const stroke of strokes) {
        if (!selectedIds.has(stroke.id)) continue;
        const b = getStrokeBounds(stroke);
        const off = dragOffset ?? { x: 0, y: 0 };
        const pad = 6 / camera.zoom;
        ctx.strokeRect(
          b.minX + off.x - pad,
          b.minY + off.y - pad,
          b.maxX - b.minX + pad * 2,
          b.maxY - b.minY + pad * 2
        );
      }
      ctx.restore();
    }

    // Rectangle de sélection en cours (marquee)
    if (marqueeRef.current) {
      const { start, current } = marqueeRef.current;
      ctx.save();
      ctx.fillStyle = "rgba(138, 180, 248, 0.15)";
      ctx.strokeStyle = "#8ab4f8";
      ctx.lineWidth = 1 / camera.zoom;
      const x = Math.min(start.x, current.x);
      const y = Math.min(start.y, current.y);
      const w = Math.abs(current.x - start.x);
      const h = Math.abs(current.y - start.y);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
  }, [strokes, camera, selectedIds]);

  useEffect(() => {
    draw();
  });

  // Redimensionnement du canvas au conteneur (sans réinitialiser la caméra).
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

  // Zoom (Ctrl/Cmd + molette, centré sur le curseur) / pan (molette seule).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      if (e.ctrlKey || e.metaKey) {
        setCamera((cam) => {
          const worldBefore = screenToWorld(screenPoint, cam);
          const newZoom = clamp(cam.zoom * Math.exp(-e.deltaY * 0.002), MIN_ZOOM, MAX_ZOOM);
          return {
            zoom: newZoom,
            x: worldBefore.x - screenPoint.x / newZoom,
            y: worldBefore.y - screenPoint.y / newZoom,
          };
        });
      } else {
        setCamera((cam) => ({ ...cam, x: cam.x + e.deltaX / cam.zoom, y: cam.y + e.deltaY / cam.zoom }));
      }
    }

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  // Suppression de la sélection au clavier.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size > 0) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        handleDeleteSelection();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, strokes]);

  function getScreenPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hitTestStroke(stroke: WhiteboardStroke, world: WhiteboardPoint): boolean {
    const b = getStrokeBounds(stroke);
    const pad = Math.max(stroke.width, 8) / camera.zoom;
    return world.x >= b.minX - pad && world.x <= b.maxX + pad && world.y >= b.minY - pad && world.y <= b.maxY + pad;
  }

  function findStrokeAt(world: WhiteboardPoint): WhiteboardStroke | undefined {
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (hitTestStroke(strokes[i], world)) return strokes[i];
    }
    return undefined;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const screenPoint = getScreenPoint(e);
    const worldPoint = screenToWorld(screenPoint, camera);

    // Bouton molette = pan temporaire, quel que soit l'outil actif.
    if (e.button === 1 || tool === "pan") {
      panStartRef.current = { screen: screenPoint, camera };
      return;
    }

    if (tool === "select") {
      const hit = findStrokeAt(worldPoint);
      if (hit && selectedIds.has(hit.id)) {
        moveDragRef.current = { startWorld: worldPoint, offset: { x: 0, y: 0 } };
      } else if (hit) {
        setSelectedIds(new Set([hit.id]));
        moveDragRef.current = { startWorld: worldPoint, offset: { x: 0, y: 0 } };
      } else {
        setSelectedIds(new Set());
        marqueeRef.current = { start: worldPoint, current: worldPoint };
      }
      forceRender((n) => n + 1);
      return;
    }

    currentStrokeRef.current = {
      id: crypto.randomUUID(),
      authorId: localParticipant.identity,
      tool,
      color: tool === "eraser" ? CANVAS_BG : color,
      width: tool === "eraser" ? width * 4 : width,
      points: [worldPoint],
    };
    setIsDrawing(true);
    forceRender((n) => n + 1);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const screenPoint = getScreenPoint(e);

    if (panStartRef.current) {
      const { screen, camera: startCam } = panStartRef.current;
      setCamera({
        ...startCam,
        x: startCam.x - (screenPoint.x - screen.x) / startCam.zoom,
        y: startCam.y - (screenPoint.y - screen.y) / startCam.zoom,
      });
      return;
    }

    if (marqueeRef.current) {
      marqueeRef.current.current = screenToWorld(screenPoint, camera);
      forceRender((n) => n + 1);
      return;
    }

    if (moveDragRef.current) {
      const worldPoint = screenToWorld(screenPoint, camera);
      moveDragRef.current.offset = {
        x: worldPoint.x - moveDragRef.current.startWorld.x,
        y: worldPoint.y - moveDragRef.current.startWorld.y,
      };
      forceRender((n) => n + 1);
      return;
    }

    if (!isDrawing || !currentStrokeRef.current) return;
    const worldPoint = screenToWorld(screenPoint, camera);
    const stroke = currentStrokeRef.current;

    if (stroke.tool === "pencil" || stroke.tool === "eraser") {
      stroke.points.push(worldPoint);
    } else {
      stroke.points = [stroke.points[0], worldPoint];
    }
    draw();
  }

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
    if (panStartRef.current) {
      panStartRef.current = null;
      return;
    }

    if (marqueeRef.current) {
      const { start, current } = marqueeRef.current;
      const marqueeBounds = {
        minX: Math.min(start.x, current.x),
        maxX: Math.max(start.x, current.x),
        minY: Math.min(start.y, current.y),
        maxY: Math.max(start.y, current.y),
      };
      const hitIds = strokes
        .filter((s) => boundsIntersect(getStrokeBounds(s), marqueeBounds))
        .map((s) => s.id);
      setSelectedIds(new Set(hitIds));
      marqueeRef.current = null;
      forceRender((n) => n + 1);
      return;
    }

    if (moveDragRef.current) {
      const { offset } = moveDragRef.current;
      if (offset.x !== 0 || offset.y !== 0) {
        setStrokes((prev) =>
          prev.map((s) => {
            if (!selectedIds.has(s.id)) return s;
            const moved = { ...s, points: s.points.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y })) };
            broadcast({ type: "update", stroke: moved });
            return moved;
          })
        );
      }
      moveDragRef.current = null;
      forceRender((n) => n + 1);
      return;
    }

    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    setIsDrawing(false);
    if (!stroke) return;

    const isShapeTool = stroke.tool !== "pencil" && stroke.tool !== "eraser";
    if (isShapeTool && stroke.points.length < 2) return;

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
    setSelectedIds(new Set());
    broadcast({ type: "clear" });
  }

  function handleDeleteSelection() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setStrokes((prev) => prev.filter((s) => !selectedIds.has(s.id)));
    for (const id of ids) broadcast({ type: "remove", strokeId: id });
    setSelectedIds(new Set());
  }

  function handleRecenter() {
    setCamera(DEFAULT_CAMERA);
  }

  /** Recadre les traits produits par MathPanel (sa propre convention 0..1)
   * dans le rectangle actuellement visible de la caméra courante. */
  function handleMathPlot(mathStrokes: WhiteboardStroke[]) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const viewWorldWidth = canvas.width / camera.zoom;
    const viewWorldHeight = canvas.height / camera.zoom;
    const remapped = mathStrokes.map((s) => ({
      ...s,
      points: s.points.map((p) => ({
        x: camera.x + p.x * viewWorldWidth,
        y: camera.y + p.y * viewWorldHeight,
      })),
    }));
    commitStrokes(remapped);
  }

  return (
    <div className="relative flex h-full w-full flex-col" style={{ backgroundColor: CANVAS_BG }}>
      {!isZen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-meet-border bg-meet-bg-secondary px-3 py-2">
          <ToolButton active={tool === "select"} onClick={() => setTool("select")} label="Sélection">
            <MousePointer2 size={16} />
          </ToolButton>
          <ToolButton active={tool === "pan"} onClick={() => setTool("pan")} label="Déplacer la vue">
            <Hand size={16} />
          </ToolButton>

          <div className="mx-1 h-6 w-px bg-meet-border" />

          <ToolButton active={tool === "pencil"} onClick={() => setTool("pencil")} label="Crayon">
            <Pencil size={16} />
          </ToolButton>
          <ToolButton active={tool === "eraser"} onClick={() => setTool("eraser")} label="Gomme">
            <Eraser size={16} />
          </ToolButton>
          <ToolButton active={tool === "line"} onClick={() => setTool("line")} label="Ligne">
            <Minus size={16} />
          </ToolButton>
          <ToolButton active={tool === "rectangle"} onClick={() => setTool("rectangle")} label="Rectangle">
            <Square size={16} />
          </ToolButton>
          <ToolButton active={tool === "circle"} onClick={() => setTool("circle")} label="Cercle">
            <CircleIcon size={16} />
          </ToolButton>
          <ToolButton active={isMathPanelOpen} onClick={() => setIsMathPanelOpen((v) => !v)} label="Fonction f(x)">
            <Sigma size={16} />
          </ToolButton>

          {isDrawingTool && (
            <>
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
                  <span className="rounded-full bg-meet-text-primary" style={{ width: w + 2, height: w + 2 }} />
                </button>
              ))}
            </>
          )}

          <div className="mx-1 h-6 w-px bg-meet-border" />

          <ToolButton onClick={handleUndo} label="Annuler mon dernier trait">
            <Undo2 size={16} />
          </ToolButton>
          <ToolButton onClick={handleRedo} label="Rétablir">
            <Redo2 size={16} />
          </ToolButton>
          {selectedIds.size > 0 && (
            <ToolButton onClick={handleDeleteSelection} label="Supprimer la sélection">
              <Trash2 size={16} />
            </ToolButton>
          )}
          {isHost && (
            <>
              <ToolButton onClick={handleClear} label="Tout effacer">
                <Trash2 size={16} />
              </ToolButton>
              <ToolButton
                onClick={toggleShareScreen}
                label={
                  isPublishing
                    ? "Partage en cours..."
                    : isSharing
                    ? "Arrêter le partage"
                    : "Partager ce tableau"
                }
                active={isSharing || isPublishing}
              >
                {isSharing ? (
                  <>
                    <EyeOff size={16} />
                    <span className="ml-1">Partage actif</span>
                  </>
                ) : (
                  <>
                    <Share2 size={16} />
                    <span className="ml-1">Partager l'écran</span>
                  </>
                )}
              </ToolButton>
            </>
          )}

          <ToolButton onClick={handleRecenter} label="Recentrer la vue">
            <LocateFixed size={16} />
          </ToolButton>
          <ToolButton onClick={() => setIsZen(true)} label="Mode zen">
            <EyeOff size={16} />
          </ToolButton>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le tableau blanc"
            className="ml-auto flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-meet-text-secondary hover:bg-meet-control hover:text-meet-text-primary"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {isZen && (
        <button
          type="button"
          onClick={() => setIsZen(false)}
          aria-label="Quitter le mode zen"
          className="absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/70 backdrop-blur transition-colors hover:bg-black/60 hover:text-white"
        >
          <Eye size={16} />
        </button>
      )}

      <div ref={containerRef} className="relative min-h-0 flex-1">
        {isMathPanelOpen && !isZen && (
          <MathPanel
            authorId={localParticipant.identity}
            color={color}
            width={width}
            onPlot={handleMathPlot}
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
          style={{ cursor: tool === "pan" ? "grab" : tool === "select" ? "default" : "crosshair" }}
        />
      </div>
    </div>
  );
}

function drawNotebookLines(ctx: CanvasRenderingContext2D, camera: WhiteboardCamera, width: number, height: number): void {
  // Only draw lines if zoomed out enough to see them (avoid too many lines when zoomed in)
  if (camera.zoom < 0.05) return;

  ctx.save();

  // Set line style - light gray for notebook lines
  ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
  ctx.lineWidth = 0.5 / camera.zoom; // Scale line width with zoom

  // Starting point for lines (aligned to grid)
  const startY = Math.floor(camera.y / 1) * 1; // 1 unit spacing

  // Draw horizontal lines (notebook style)
  for (let y = startY; y <= startY + height / camera.zoom; y += 1) {
    const screenY = (y - camera.y) * camera.zoom;
    if (screenY >= 0 && screenY <= height) {
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(width, screenY);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: WhiteboardStroke): void {
  if (stroke.points.length === 0) return;

  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.tool === "pencil" || stroke.tool === "eraser" || stroke.tool === "function") {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    return;
  }

  if (stroke.points.length < 2) return;
  const a = stroke.points[0];
  const b = stroke.points[stroke.points.length - 1];

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
  disabled,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : active
          ? "bg-meet-blue text-meet-bg"
          : "text-meet-text-secondary hover:bg-meet-control hover:text-meet-text-primary"
      }`}
    >
      {children}
    </button>
  );
}