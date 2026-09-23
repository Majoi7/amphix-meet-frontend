import { useMemo } from "react";
import { Eye, EyeOff, SlidersHorizontal, TriangleAlert } from "lucide-react";
import {
  DEFAULT_OBJECT_COLOR,
  MATH_OBJECT_KIND_LABELS,
  OBJECT_COLORS,
  type MathConstruction,
  type MathObject,
  type MathObjectStyle,
} from "../../lib/math/construction";
import { describeObject } from "../../lib/math/geometry";
import { OBJECT_ICONS } from "./mathObjectIcons";

/**
 * Propriétés de l'objet sélectionné.
 *
 * Il travaille UNIQUEMENT sur `construction.selection` : pas de `useState`
 * local pour l'objet courant, pas d'identifiant retenu à part. Sélectionner
 * dans la liste — ou cliquer l'objet sur le graphe — c'est donc immédiatement
 * éditer ici : il n'y a rien à synchroniser, parce qu'il n'y a qu'une seule
 * copie de la vérité.
 *
 * Le panneau reste VOLONTAIREMENT RESTREINT : nom, couleur, et une seule
 * grandeur suivant le genre — la taille pour un point, l'épaisseur pour un
 * trait. Ces propriétés suffisent à prouver la chaîne complète
 * `modèle → sélection → propriété → renderer`, et elles sont éditées par
 * `updateObjectStyle`, donc par le modèle.
 *
 * La définition est affichée mais NON modifiable : elle appartient à l'outil
 * qui l'a produite. L'éditer ici créerait un second chemin d'écriture vers le
 * même champ — et pour un objet dérivé, il n'y a de toute façon rien à éditer,
 * puisque sa description se CALCULE à partir de ses dépendances.
 */

/** Tailles proposées pour un point, en pixels. */
const POINT_SIZES = [2, 3, 4, 6, 8] as const;

/** Épaisseurs proposées pour un trait. */
const WIDTHS = [1, 2, 3, 4] as const;

/** Les points se dessinent par une taille, les autres objets par une
 *  épaisseur de trait : proposer les deux n'aurait aucun effet sur l'un ou
 *  l'autre. Les intersections sont des points. */
function isPointLike(kind: MathObject["kind"]): boolean {
  return kind === "point" || kind === "intersection";
}

/**
 * Le glyphe du genre, teinté de la couleur de l'objet.
 *
 * Il répond d'un coup d'œil aux deux questions qu'on se pose en arrivant sur ce
 * panneau — « qu'est-ce que c'est ? » et « de quelle couleur est-ce ? » —
 * là où le titre ne répondait qu'à la première.
 */
function KindGlyph({ object }: { object: MathObject }) {
  const Icon = OBJECT_ICONS[object.kind];
  return (
    <Icon
      size={13}
      aria-hidden="true"
      className="shrink-0"
      style={{ color: object.style.color ?? DEFAULT_OBJECT_COLOR }}
    />
  );
}

export function MathPropertiesPanel({
  construction,
  invalid,
  onUpdateStyle,
  onUpdateObject,
  onSetVisibility,
}: {
  construction: MathConstruction;
  /** Objets géométriquement inexploitables, et la raison, en français. */
  invalid: ReadonlyMap<string, string>;
  onUpdateStyle: (id: string, patch: MathObjectStyle) => void;
  onUpdateObject: (id: string, patch: { label?: string }) => void;
  onSetVisibility: (id: string, visible: boolean) => void;
}) {
  const selectedId = construction.selection.selectedObjectId;
  const object =
    selectedId === null
      ? undefined
      : construction.objects.find((candidate) => candidate.id === selectedId);

  const byId = useMemo(() => {
    const map = new Map<string, MathObject>();
    for (const candidate of construction.objects) map.set(candidate.id, candidate);
    return map;
  }, [construction.objects]);

  const invalidReason = object ? invalid.get(object.id) ?? null : null;

  return (
    <section className="app-card" aria-labelledby="math-properties-title">
      <header className="app-card-head">
        <div className="min-w-0">
          <h2 id="math-properties-title" className="app-card-title">
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal size={15} aria-hidden="true" />
              Propriétés
            </span>
          </h2>
          <p className="app-card-desc">
            {object ? (
              <span className="inline-flex items-center gap-1.5">
                <KindGlyph object={object} />
                {MATH_OBJECT_KIND_LABELS[object.kind]} sélectionné.
              </span>
            ) : (
              "Sélectionne un objet dans la liste ou sur le graphe pour le modifier."
            )}
          </p>
        </div>
      </header>

      {object && (
        <div className="app-card-body flex flex-col gap-4">
          {invalidReason !== null && (
            <p
              className="m-0 flex items-start gap-2 rounded-md px-2.5 py-2 text-[12.5px] leading-snug"
              style={{
                backgroundColor: "var(--app-surface-2)",
                color: "var(--app-text-muted)",
              }}
            >
              <TriangleAlert
                size={14}
                aria-hidden="true"
                className="mt-0.5 shrink-0"
                style={{ color: "var(--app-accent-strong)" }}
              />
              <span>
                <span className="font-semibold" style={{ color: "var(--app-text)" }}>
                  Objet non tracé.{" "}
                </span>
                {invalidReason}
              </span>
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="app-label" htmlFor="math-prop-label">
              Nom
            </label>
            <input
              id="math-prop-label"
              className="app-input app-input-sm"
              type="text"
              value={object.label ?? ""}
              placeholder={object.id}
              onChange={(event) => onUpdateObject(object.id, { label: event.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="app-label">Définition</span>
            <p
              className="app-mono m-0 truncate text-[12.5px]"
              style={{ color: "var(--app-text-muted)" }}
              title={describeObject(object, byId)}
            >
              {describeObject(object, byId)}
            </p>
            <p className="m-0 text-[11.5px]" style={{ color: "var(--app-text-subtle)" }}>
              {object.dependencies.length > 0
                ? "Calculée à partir des objets dont elle dépend."
                : "Modifiable depuis l'outil qui l'a créé."}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="app-label">Couleur</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {OBJECT_COLORS.map((color) => {
                const active = (object.style.color ?? DEFAULT_OBJECT_COLOR) === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => onUpdateStyle(object.id, { color })}
                    aria-label={`Couleur ${color}`}
                    aria-pressed={active}
                    className="shrink-0 rounded-full ring-2 transition-transform"
                    style={{
                      width: 22,
                      height: 22,
                      backgroundColor: color,
                      transform: active ? "scale(1.12)" : undefined,
                      // L'anneau reprend la couleur du texte du thème : il reste
                      // visible sur fond clair comme sur fond sombre.
                      boxShadow: active ? "0 0 0 2px var(--app-text)" : undefined,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {isPointLike(object.kind) ? (
            <div className="flex flex-col gap-1.5">
              <span className="app-label">Taille</span>
              <div className="flex items-center gap-1.5">
                {POINT_SIZES.map((size) => {
                  const active = (object.style.pointSize ?? 4) === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => onUpdateStyle(object.id, { pointSize: size })}
                      aria-label={`Taille ${size}`}
                      aria-pressed={active}
                      className="app-btn app-btn-secondary"
                      style={
                        active
                          ? { borderColor: "var(--app-accent)", color: "var(--app-text)" }
                          : undefined
                      }
                    >
                      <span
                        aria-hidden="true"
                        className="block rounded-full"
                        style={{
                          width: size * 2,
                          height: size * 2,
                          backgroundColor: object.style.color ?? DEFAULT_OBJECT_COLOR,
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="app-label">Épaisseur</span>
              <div className="flex items-center gap-1.5">
                {WIDTHS.map((width) => {
                  const active = (object.style.width ?? 2) === width;
                  return (
                    <button
                      key={width}
                      type="button"
                      onClick={() => onUpdateStyle(object.id, { width })}
                      aria-label={`Épaisseur ${width}`}
                      aria-pressed={active}
                      className="app-btn app-btn-secondary"
                      style={
                        active
                          ? { borderColor: "var(--app-accent)", color: "var(--app-text)" }
                          : undefined
                      }
                    >
                      <span
                        aria-hidden="true"
                        className="block rounded-full"
                        style={{
                          width: 20,
                          height: width,
                          backgroundColor: object.style.color ?? DEFAULT_OBJECT_COLOR,
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="app-label">Visibilité</span>
            <button
              type="button"
              className="app-btn app-btn-secondary self-start"
              onClick={() => onSetVisibility(object.id, !object.visible)}
              aria-pressed={object.visible}
            >
              {object.visible ? (
                <Eye size={14} aria-hidden="true" />
              ) : (
                <EyeOff size={14} aria-hidden="true" />
              )}
              {object.visible ? "Visible" : "Masqué"}
            </button>
          </div>

          {object.dependencies.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="app-label">Dépend de</span>
              <p className="app-mono m-0 text-[12px]" style={{ color: "var(--app-text-muted)" }}>
                {object.dependencies
                  .map((id) => {
                    const dependency = byId.get(id);
                    return dependency ? dependency.label ?? dependency.id : `${id} (absent)`;
                  })
                  .join(", ")}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
