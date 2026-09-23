import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
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
import {
  boundsIntersect,
  findStrokeAt,
  getStrokeBounds,
  hitTestStroke,
  strokeTouchTolerance,
} from "../lib/whiteboardHitTest";
import {
  DEFAULT_BACKGROUND_ID,
  SHEET_HEIGHT,
  SHEET_MIN_X,
  SHEET_MIN_Y,
  SHEET_WIDTH,
  WHITEBOARD_BACKGROUNDS,
  getBackground,
  getReadyBackgroundImage,
  subscribeBackgroundImages,
  type WhiteboardBackgroundDefinition,
} from "../lib/whiteboardBackgrounds";
import { MathPanel } from "./MathPanel";
import type {
  WhiteboardCamera,
  WhiteboardData,
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
  | { type: "clear" }
  | { type: "background"; backgroundId: string };

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function screenToWorld(p: { x: number; y: number }, camera: WhiteboardCamera): WhiteboardPoint {
  return { x: p.x / camera.zoom + camera.x, y: p.y / camera.zoom + camera.y };
}

/**
 * Rayon de contact de la gomme, en pixels écran.
 *
 * Volontairement indépendant du zoom : une gomme garde la même taille
 * apparente qu'on soit zoomé ou non, comme dans n'importe quelle application
 * de dessin. La taille choisie dans la barre d'outils la fait varier.
 */
function eraserRadiusPx(eraserWidth: number): number {
  return Math.max(eraserWidth * 2, 12);
}

/**
 * Entrée d'historique. Le MÊME type décrit l'annulation et le rétablissement :
 * l'inverse d'un ajout est une suppression, et réciproquement — il suffit donc
 * de rejouer l'entrée dans l'autre sens.
 *
 * `strokes` porte les objets eux-mêmes, pas seulement leurs identifiants :
 * une gomme doit pouvoir RESTAURER ce qu'elle a effacé, ce qu'un simple
 * `string[]` d'ids ne permettrait pas.
 */
interface HistoryEntry {
  kind: "add" | "erase";
  /** Ordre d'ajout pour `"add"` ; ordre de SUPPRESSION pour `"erase"`. */
  strokes: Array<{ stroke: WhiteboardStroke; index: number }>;
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
 * La gomme SUPPRIME les traits qu'elle touche (elle ne peint pas par-dessus) :
 * elle ne dépend donc d'aucune couleur de fond, et un changement de fond ne
 * peut pas la casser. Elle réutilise le message `remove` déjà existant.
 *
 * Undo/redo reste limité à SES PROPRES traits (pas de CRDT).
 */
export function Whiteboard({ roomId, isHost, onClose }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { localParticipant } = useLocalParticipant();

  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  // Fond de la feuille — état SÉPARÉ des traits : il n'entre ni dans
  // l'historique undo/redo, ni dans la sélection, ni dans la gomme.
  const [backgroundId, setBackgroundId] = useState<string>(DEFAULT_BACKGROUND_ID);
  const [isBackgroundMenuOpen, setIsBackgroundMenuOpen] = useState(false);
  // Passe à vrai quand le GET initial a abouti (ou échoué) : tant qu'il est
  // faux, on ne sauvegarde rien.
  const [isLoaded, setIsLoaded] = useState(false);
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

  // Gomme : geste en cours, traits déjà effacés pendant CE geste (dans leur
  // ordre de suppression), et leurs identifiants pour ne jamais effacer deux
  // fois le même trait.
  const isErasingRef = useRef(false);
  const erasedRef = useRef<Array<{ stroke: WhiteboardStroke; index: number }>>([]);
  const erasedIdsRef = useRef<Set<string>>(new Set());

  // Miroir synchrone de `strokes`. Le hit-test de la gomme doit lire l'état
  // COURANT pendant un glissement, alors qu'un gestionnaire d'événement peut
  // capturer une valeur de `strokes` antérieure au dernier rendu.
  const strokesRef = useRef<WhiteboardStroke[]>([]);

  // Passe à vrai dès qu'un message LiveKit a été appliqué OU qu'une
  // modification locale a eu lieu. Au retour du GET initial, il décide s'il
  // faut REMPLACER l'état ou FUSIONNER avec ce qui est déjà arrivé — sans lui,
  // la réponse du serveur écrase les traits reçus entre-temps (course déjà
  // relevée à l'audit).
  const syncTouchedRef = useRef(false);

  const undoStackRef = useRef<HistoryEntry[]>([]);
  const redoStackRef = useRef<HistoryEntry[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDrawingTool = tool === "pencil" || tool === "eraser" || tool === "line" || tool === "rectangle" || tool === "circle";

  const { send } = useDataChannel(DATA_TOPIC, (msg) => {
    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.payload)) as WhiteboardMessage;
      // Tout message valide marque l'état comme « déjà touché » : la réponse du
      // GET initial ne devra donc plus l'écraser, seulement le compléter.
      syncTouchedRef.current = true;
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
      } else if (payload.type === "background") {
        // Idempotent : `getBackground` ramène un identifiant inconnu au fond
        // par défaut, et React ne re-rend pas si la valeur est identique.
        setBackgroundId(getBackground(payload.backgroundId).id);
      }
    } catch {
      /* message malformé — ignoré */
    }
  });

  function broadcast(message: WhiteboardMessage) {
    send(new TextEncoder().encode(JSON.stringify(message)), { reliable: true });
  }

  // Maintient le miroir synchrone à jour (voir `strokesRef`).
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  // Chargement + conversion des anciennes données (normalisé 0..1 → monde).
  useEffect(() => {
    let cancelled = false;
    getWhiteboard(roomId)
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        const isLegacy = data.version !== 2;
        const loaded = (data.strokes ?? []).map((s) =>
          isLegacy
            ? { ...s, points: s.points.map((p) => ({ x: p.x * WHITEBOARD_LEGACY_WIDTH, y: p.y * WHITEBOARD_LEGACY_HEIGHT })) }
            : s
        );
        const loadedBackground = getBackground(data.background).id;

        if (!syncTouchedRef.current) {
          // Rien n'est arrivé entre-temps : l'état serveur fait référence.
          setStrokes(loaded);
          setBackgroundId(loadedBackground);
          setIsLoaded(true);
          return;
        }

        // Sinon on FUSIONNE au lieu de remplacer. Ce qui est déjà à l'écran
        // (traits reçus par le canal, ou dessinés entre-temps) est plus récent
        // que la réponse du serveur et ne doit pas disparaître ; on n'ajoute
        // que ce que le serveur connaît et que le canal n'a pas apporté.
        setStrokes((prev) => {
          const known = new Set(prev.map((s) => s.id));
          const missing = loaded.filter((s) => !known.has(s.id));
          return missing.length > 0 ? [...missing, ...prev] : prev;
        });
        // Le fond ne se fusionne pas : un seul est actif. Celui qu'a apporté le
        // canal est le plus récent, on n'y touche donc pas.
        setIsLoaded(true);
      })
      .catch(() => {
        // Silencieux — on part d'un tableau vide. On autorise quand même la
        // sauvegarde : un chargement raté ne doit pas geler la persistance.
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const scheduleSave = useCallback(
    (data: WhiteboardData) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveWhiteboard(roomId, data).catch(() => {
          /* silencieux — la sync temps réel reste fonctionnelle même si la sauvegarde échoue */
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [roomId]
  );

  useEffect(() => {
    // Jamais avant la fin du chargement initial : sinon un client lent
    // enverrait un tableau vide (et le fond par défaut) et effacerait le
    // travail des autres.
    if (!isLoaded) return;
    scheduleSave({ version: 2, strokes, background: backgroundId });
  }, [isLoaded, strokes, backgroundId, scheduleSave]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const background = getBackground(backgroundId);

    // 1) La feuille (fond) — couche la plus basse, dans le repère monde.
    ctx.setTransform(camera.zoom, 0, 0, camera.zoom, -camera.x * camera.zoom, -camera.y * camera.zoom);
    drawSheet(ctx, background);

    // 2) Grille de cahier éventuelle. Tracée en espace écran comme avant, mais
    //    DÉCOUPÉE à la feuille : sans cela elle déborderait sur le vide autour
    //    et salirait une illustration.
    if (background.grid) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.save();
      ctx.beginPath();
      ctx.rect(
        (SHEET_MIN_X - camera.x) * camera.zoom,
        (SHEET_MIN_Y - camera.y) * camera.zoom,
        SHEET_WIDTH * camera.zoom,
        SHEET_HEIGHT * camera.zoom
      );
      ctx.clip();
      drawNotebookLines(ctx, camera, canvas.width, canvas.height);
      ctx.restore();
    }

    // 3) Les traits — le repère monde est reposé.
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
  }, [strokes, camera, selectedIds, backgroundId]);

  useEffect(() => {
    draw();
  });

  // Une image de fond qui finit de se décoder doit déclencher UN redessin.
  // Le cache du registre garantit qu'aucune `Image()` n'est recréée ensuite.
  useEffect(() => subscribeBackgroundImages(() => forceRender((n) => n + 1)), []);

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

  /**
   * Efface tous les traits réellement touchés sous `worldPoint`.
   *
   * C'est le cœur de la correction : la gomme DÉTRUIT des objets, elle ne
   * peint plus par-dessus. Un seul message réseau est utilisé, `remove`, qui
   * existait déjà et était déjà appliqué par les autres participants.
   */
  function eraseAt(worldPoint: WhiteboardPoint) {
    const current = strokesRef.current;
    const radius = eraserRadiusPx(width);
    const hits: Array<{ stroke: WhiteboardStroke; index: number }> = [];

    for (let i = 0; i < current.length; i++) {
      const stroke = current[i];
      // Un trait déjà effacé pendant ce geste ne peut plus l'être : le test
      // ci-dessous est déjà aveugle à ce qu'on a retiré de `strokesRef`, le
      // Set est la ceinture en plus des bretelles.
      if (erasedIdsRef.current.has(stroke.id)) continue;
      if (hitTestStroke(stroke, worldPoint, strokeTouchTolerance(stroke, camera.zoom, radius))) {
        hits.push({ stroke, index: i });
      }
    }
    if (hits.length === 0) return;

    syncTouchedRef.current = true;
    for (const hit of hits) {
      erasedRef.current.push(hit);
      erasedIdsRef.current.add(hit.stroke.id);
    }

    const removedIds = new Set(hits.map((hit) => hit.stroke.id));
    const next = current.filter((s) => !removedIds.has(s.id));
    strokesRef.current = next;
    setStrokes(next);

    for (const id of removedIds) broadcast({ type: "remove", strokeId: id });
    forceRender((n) => n + 1);
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

    // Gomme : elle n'écrit rien, elle supprime — elle agit donc dès le
    // pointerdown. C'est nécessaire, car un clic isolé ne produit qu'un seul
    // point, insuffisant pour dessiner un trait.
    if (tool === "eraser" && e.button === 0) {
      erasedRef.current = [];
      erasedIdsRef.current = new Set();
      isErasingRef.current = true;
      eraseAt(worldPoint);
      return;
    }

    if (tool === "select") {
      const hit = findStrokeAt(strokesRef.current, worldPoint, camera.zoom);
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

    // Aucun trait "eraser" n'est plus jamais créé : seuls les documents
    // antérieurs peuvent en contenir, et ils restent lus et dessinés.
    currentStrokeRef.current = {
      id: crypto.randomUUID(),
      authorId: localParticipant.identity,
      tool,
      color,
      width,
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

    // Gomme : on continue d'effacer tout ce que le geste traverse.
    if (isErasingRef.current) {
      eraseAt(screenToWorld(screenPoint, camera));
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
    syncTouchedRef.current = true;
    setStrokes((prev) => [...prev, ...newStrokes]);
    // Un seul pas d'historique pour tout le lot : annuler un tracé de fonction
    // (plusieurs traits) doit le retirer d'un coup.
    undoStackRef.current.push({
      kind: "add",
      strokes: newStrokes.map((stroke) => ({ stroke, index: -1 })),
    });
    for (const s of newStrokes) broadcast({ type: "stroke", stroke: s });
    redoStackRef.current = [];
    // Pas de `strokesRef.current` ici : il sera recalé par l'effet de
    // synchronisation dès le prochain rendu.
  }

  /**
   * Réinsère des traits à leur place d'origine.
   *
   * Pour une gomme, `strokes` est dans l'ordre de SUPPRESSION : on réinsère
   * donc en ordre inverse. Une fois le dernier trait enlevé remis, le tableau
   * retrouve exactement l'état qui précédait le retrait de l'avant-dernier —
   * l'index relevé à chaque étape redevient alors valide. Restaurer dans
   * l'ordre de suppression, à l'inverse, décalerait tout.
   */
  function restoreStrokes(entry: HistoryEntry) {
    const items = entry.kind === "erase" ? [...entry.strokes].reverse() : entry.strokes;
    setStrokes((prev) => {
      const next = [...prev];
      for (const { stroke, index } of items) {
        // `index < 0` : trait re-créé par un rétablissement, ajouté en fin.
        const at = index < 0 ? next.length : Math.max(0, Math.min(index, next.length));
        next.splice(at, 0, stroke);
      }
      return next;
    });
    for (const { stroke } of items) broadcast({ type: "stroke", stroke });
  }

  /** Retire des traits. Le message `remove` est celui qui existait déjà. */
  function removeStrokes(entry: HistoryEntry) {
    const ids = new Set(entry.strokes.map((item) => item.stroke.id));
    setStrokes((prev) => prev.filter((s) => !ids.has(s.id)));
    for (const id of ids) broadcast({ type: "remove", strokeId: id });
  }

  function handlePointerUp() {
    if (isErasingRef.current) {
      isErasingRef.current = false;
      // Un geste de gomme = UN pas d'historique, quel que soit le nombre de
      // traits effacés : Ctrl+Z doit les ramener tous ensemble.
      if (erasedRef.current.length > 0) {
        undoStackRef.current.push({ kind: "erase", strokes: erasedRef.current });
        redoStackRef.current = [];
      }
      erasedRef.current = [];
      erasedIdsRef.current = new Set();
      return;
    }

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
        // Les traits déplacés sont calculés AVANT le `setStrokes` : diffuser
        // depuis l'intérieur d'un updater le fait exécuter deux fois en mode
        // strict (React 18), donc envoyer deux fois le même message.
        const moved = strokesRef.current
          .filter((s) => selectedIds.has(s.id))
          .map((s) => ({
            ...s,
            points: s.points.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y })),
          }));
        if (moved.length > 0) {
          const byId = new Map(moved.map((s) => [s.id, s]));
          setStrokes((prev) => prev.map((s) => byId.get(s.id) ?? s));
          for (const stroke of moved) broadcast({ type: "update", stroke });
        }
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
    const entry = undoStackRef.current.pop();
    if (!entry) return;
    // L'inverse d'un ajout est un retrait, et réciproquement : la même entrée
    // décrit les deux sens, il suffit de la rejouer à l'envers.
    if (entry.kind === "add") removeStrokes(entry);
    else restoreStrokes(entry);
    redoStackRef.current.push(entry);
  }

  function handleRedo() {
    const entry = redoStackRef.current.pop();
    if (!entry) return;
    if (entry.kind === "add") restoreStrokes(entry);
    else removeStrokes(entry);
    undoStackRef.current.push(entry);
  }

  function handleClear() {
    syncTouchedRef.current = true;
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

  /**
   * Change le fond de la feuille.
   *
   * Appliqué localement, diffusé par le canal existant, puis persisté par le
   * `scheduleSave` déjà en place — aucun nouveau protocole, aucune route.
   *
   * Volontairement HORS de tout updater `setState` : en mode strict React
   * exécute les updaters deux fois, ce qui enverrait le message en double.
   * Le fond ne touche ni `strokes`, ni `selectedIds`, ni les piles
   * d'historique : Ctrl+Z ne peut donc pas l'annuler et la gomme l'ignore.
   */
  function handleSelectBackground(id: string) {
    // Un identifiant inconnu retombe sur le fond par défaut (idempotence).
    const resolved = getBackground(id).id;
    syncTouchedRef.current = true;
    setBackgroundId(resolved);
    setIsBackgroundMenuOpen(false);
    broadcast({ type: "background", backgroundId: resolved });
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
        <div className="relative flex flex-wrap items-center gap-2 border-b border-meet-border bg-meet-bg-secondary px-3 py-2">
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

          <BackgroundControl
            activeId={backgroundId}
            isOpen={isBackgroundMenuOpen}
            onToggle={() => setIsBackgroundMenuOpen((v) => !v)}
            onSelect={handleSelectBackground}
            onClose={() => setIsBackgroundMenuOpen(false)}
          />

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

/**
 * Dessine la feuille — la couche LA PLUS BASSE, sous la grille et sous les
 * traits. Elle vit dans le repère monde : elle suit donc exactement le zoom,
 * le pan et le recentrage, et se retrouve telle quelle dans le canvas capturé
 * par le partage d'écran (le fond n'est PAS un `background-image` CSS, qui
 * aurait été ignoré par `captureStream`).
 *
 * Rien ici ne touche à `strokes` : changer de fond ne peut ni modifier un
 * dessin, ni entrer dans l'historique, ni réveiller la gomme.
 */
function drawSheet(
  ctx: CanvasRenderingContext2D,
  background: WhiteboardBackgroundDefinition
): void {
  if (background.kind === "color") {
    ctx.fillStyle = background.value;
    ctx.fillRect(SHEET_MIN_X, SHEET_MIN_Y, SHEET_WIDTH, SHEET_HEIGHT);
    return;
  }

  const image = getReadyBackgroundImage(background);
  if (image) {
    // La feuille est en 16:9 et les visuels sont proches de ce rapport :
    // l'étirement résiduel est négligeable, et il vaut mieux cela qu'une bande
    // vide sur un bord.
    ctx.drawImage(image, SHEET_MIN_X, SHEET_MIN_Y, SHEET_WIDTH, SHEET_HEIGHT);
  } else {
    // Image pas encore décodée : on peint la couleur de repli pour que le
    // premier rendu ne soit pas un trou, et `subscribeBackgroundImages`
    // déclenchera le redessin dès que l'image est prête.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(SHEET_MIN_X, SHEET_MIN_Y, SHEET_WIDTH, SHEET_HEIGHT);
  }

  // Liseré discret : la feuille se détache du vide qui l'entoure.
  ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(SHEET_MIN_X, SHEET_MIN_Y, SHEET_WIDTH, SHEET_HEIGHT);
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

/** Aperçu d'un fond : aplat de couleur, ou miniature de l'image. */
function BackgroundThumbnail({
  definition,
  className = "h-8 w-14",
}: {
  definition: WhiteboardBackgroundDefinition;
  className?: string;
}) {
  return (
    <span
      className={`shrink-0 overflow-hidden rounded-md ring-1 ring-black/15 ${className}`}
      style={definition.kind === "color" ? { backgroundColor: definition.value } : undefined}
    >
      {definition.kind === "image" && (
        <img
          src={definition.value}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      )}
    </span>
  );
}

/**
 * Commande de fond : un bouton dans la barre d'outils, plus un menu.
 *
 * Le menu est ancré à la BARRE et non au bouton : sur mobile la barre se replie
 * sur plusieurs lignes, et un menu accroché au bouton sortirait de l'écran
 * selon la ligne où il atterrit. `max-w-[calc(100vw-1rem)]` garantit qu'il ne
 * déborde jamais horizontalement.
 *
 * La liste des fonds vient entièrement du registre — rien n'est décrit ici.
 */
function BackgroundControl({
  activeId,
  isOpen,
  onToggle,
  onSelect,
  onClose,
}: {
  activeId: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const active = getBackground(activeId);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Element | null;
      if (menuRef.current && target && menuRef.current.contains(target)) return;
      // Le bouton d'ouverture gère lui-même la bascule : fermer ici aussi
      // fermerait puis rouvrirait dans la même interaction.
      if (target && target.closest("[data-background-toggle]")) return;
      onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <>
      <button
        type="button"
        data-background-toggle
        onClick={onToggle}
        aria-label={`Fond du tableau — ${active.label}`}
        aria-expanded={isOpen}
        title="Fond du tableau"
        className={`flex h-8 flex-shrink-0 items-center gap-1 rounded-full px-1.5 transition-colors ${
          isOpen
            ? "bg-meet-blue text-meet-bg"
            : "text-meet-text-secondary hover:bg-meet-control hover:text-meet-text-primary"
        }`}
      >
        <BackgroundThumbnail definition={active} className="h-5 w-9" />
        <ChevronDown size={13} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="group"
          aria-label="Choix du fond du tableau"
          className="absolute right-2 top-full z-30 mt-1 w-64 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-meet-border bg-meet-bg-secondary p-1.5 shadow-2xl"
        >
          <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-meet-text-secondary">
            Fond du tableau
          </p>
          {WHITEBOARD_BACKGROUNDS.map((definition) => {
            const isActive = definition.id === activeId;
            return (
              <button
                key={definition.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelect(definition.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
                  isActive ? "bg-meet-control" : "hover:bg-meet-control"
                }`}
              >
                <BackgroundThumbnail definition={definition} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-meet-text-primary">
                  {definition.label}
                </span>
                {isActive && (
                  <Check size={15} className="shrink-0 text-meet-blue" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
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