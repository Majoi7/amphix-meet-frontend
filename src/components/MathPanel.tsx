import { useState } from "react";
import { Sigma, X } from "lucide-react";
import { sampleFunction, buildAxisStrokes, DEFAULT_VIEWPORT, type MathViewport } from "../lib/cartesian";
import type { WhiteboardStroke } from "../types/whiteboard";

interface MathPanelProps {
  authorId: string;
  color: string;
  width: number;
  onPlot: (strokes: WhiteboardStroke[]) => void;
  onClose: () => void;
}

/**
 * Panneau "espace mathématique" — pour l'instant limité au traçage de
 * courbes f(x) sur un repère cartésien (section 15 du cahier des
 * charges, qui autorise explicitement à ne pas tout construire dès la
 * V1). L'architecture (mathExpression.ts pour le parsing, cartesian.ts
 * pour la conversion en traits du tableau) reste volontairement générique
 * pour accueillir plus tard une calculatrice, dérivées/intégrales, etc.
 * sans tout refaire.
 */
export function MathPanel({ authorId, color, width, onPlot, onClose }: MathPanelProps) {
  const [expression, setExpression] = useState("x^2");
  const [viewport, setViewport] = useState<MathViewport>(DEFAULT_VIEWPORT);
  const [error, setError] = useState<string | null>(null);

  function handlePlot() {
    setError(null);
    try {
      const segments = sampleFunction(expression, viewport);
      if (segments.length === 0) {
        setError("Aucun point valide sur cet intervalle.");
        return;
      }
      const strokes: WhiteboardStroke[] = segments.map((points) => ({
        id: crypto.randomUUID(),
        authorId,
        tool: "function",
        color,
        width,
        points,
      }));
      onPlot(strokes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Expression invalide.");
    }
  }

  function handleAddAxes() {
    onPlot(buildAxisStrokes(viewport, authorId));
  }

  return (
    <div className="absolute right-3 top-14 z-10 w-72 rounded-xl bg-meet-bg-secondary p-3 shadow-2xl ring-1 ring-meet-border">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-meet-text-primary">
          <Sigma size={16} /> Fonction
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="rounded p-1 text-meet-text-secondary hover:bg-meet-control"
        >
          <X size={16} />
        </button>
      </div>

      <label className="mb-1 block text-xs text-meet-text-secondary">f(x) =</label>
      <input
        type="text"
        value={expression}
        onChange={(e) => setExpression(e.target.value)}
        placeholder="ex: 2*x^2 - 3*x + 1"
        className="mb-2 w-full rounded-lg border border-meet-border bg-meet-bg px-3 py-2 text-sm text-meet-text-primary placeholder:text-meet-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-meet-blue"
      />
      <p className="mb-2 text-[10px] text-meet-text-disabled">
        Multiplication explicite requise (2*x, pas 2x). Fonctions : sin, cos, tan, sqrt, abs, log,
        ln, exp. Constantes : pi, e.
      </p>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <NumberField
          label="x min"
          value={viewport.xMin}
          onChange={(v) => setViewport((vp) => ({ ...vp, xMin: v }))}
        />
        <NumberField
          label="x max"
          value={viewport.xMax}
          onChange={(v) => setViewport((vp) => ({ ...vp, xMax: v }))}
        />
        <NumberField
          label="y min"
          value={viewport.yMin}
          onChange={(v) => setViewport((vp) => ({ ...vp, yMin: v }))}
        />
        <NumberField
          label="y max"
          value={viewport.yMax}
          onChange={(v) => setViewport((vp) => ({ ...vp, yMax: v }))}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAddAxes}
          className="flex-1 rounded-full border border-meet-border px-3 py-2 text-xs font-medium text-meet-text-primary hover:bg-meet-control"
        >
          Ajouter le repère
        </button>
        <button
          type="button"
          onClick={handlePlot}
          className="flex-1 rounded-full bg-meet-blue px-3 py-2 text-xs font-medium text-meet-bg hover:bg-meet-blue-hover"
        >
          Tracer
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-meet-yellow">{error}</p>}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] text-meet-text-secondary">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-meet-border bg-meet-bg px-2 py-1.5 text-xs text-meet-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-meet-blue"
      />
    </label>
  );
}
