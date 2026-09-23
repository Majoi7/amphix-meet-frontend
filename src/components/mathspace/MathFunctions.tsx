import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Grid3x3, Plus, Trash2 } from "lucide-react";
import {
  compileFunction,
  evaluateAt,
  evaluateConstant,
  type CompiledFunction,
} from "../../lib/math";
import {
  DEFAULT_OBJECT_COLOR,
  DEFAULT_VIEW,
  allocateColor,
  allocateLabel,
  makeObjectId,
} from "../../lib/math/construction";
import { formatApproximate, formatTableValue } from "../../lib/math/format";
import { useTheme } from "../../context/ThemeContext";
import { MathInput, type MathInputHandle } from "./MathInput";
import { MathKeyboard, MathKeyboardHints } from "./MathKeyboard";
import { MathGraph, type CanvasPick } from "./MathGraph";
import type { MathConstructionApi } from "./useMathConstruction";

/**
 * Onglet Fonctions : tracer, zoomer, lire des valeurs.
 *
 * CE QUI A CHANGÉ
 *
 * Les lignes de fonctions vivaient dans un `useState` local à ce composant.
 * Elles vivent maintenant dans la construction, qui appartient à l'espace de
 * travail : ce panneau la LIT et la MODIFIE, il ne la détient plus. Fermer
 * l'onglet, détruire le graphe ou recharger le renderer ne perd donc plus rien.
 *
 * Aucun état de fonction ne subsiste ici : le champ affiche `object.definition`
 * et écrit `object.definition`. Une copie locale rendrait le modèle menteur dès
 * la première frappe.
 *
 * Le tracé est calculé par le MÊME moteur que la calculatrice — il n'y a pas
 * deux analyseurs d'expressions dans l'application. Une fonction qui ne se
 * compile pas n'est pas tracée et son message d'erreur s'affiche SOUS son
 * champ, sans interrompre le rendu des autres courbes.
 *
 * TEMPORISATION
 *
 * Le graphe suit le modèle en direct : recréer une seule courbe est
 * négligeable, et le tracé ne doit pas retarder sur l'expression saisie. Le
 * TABLEAU DE VALEURS, lui, reste temporisé (300 ms) : il réévalue chaque
 * fonction en arithmétique exacte, ce qui est le vrai coût. C'est un délai
 * d'AFFICHAGE sur une sortie dérivée, pas une seconde copie de l'état — la
 * touche « = » du clavier force le calcul immédiat.
 *
 * L'ATTRIBUTION DES NOMS ET DES COULEURS n'est plus faite ici : elle est
 * passée au modèle (`allocateLabel`, `allocateColor`), parce que la géométrie a
 * désormais besoin des mêmes règles. Deux attributions concurrentes
 * finiraient par se contredire. Les palettes sont inchangées : les quatre
 * premières couleurs du modèle sont exactement celles des courbes, et les
 * quatre premiers noms restent « f », « g », « h », « k ».
 */

const MAX_CURVES = 4;
const TABLE_X = [-3, -2, -1, 0, 1, 2, 3];

/** Valeur retardée — évite un recalcul par frappe. `flush` force le calcul. */
function useDebounced<T>(value: T, delay: number): [T, () => void] {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  const flush = useCallback(() => setDebounced(value), [value]);
  return [debounced, flush];
}

/** Colonne du tableau de valeurs : une fonction compilée, prête à évaluer. */
interface PlottedFunction {
  id: string;
  label: string;
  color: string;
  evaluate: (x: number) => number;
  /** La source est conservée : le tableau réévalue la MÊME expression pour en
   *  donner la forme exacte, qu'un simple `(x) => number` ne peut pas
   *  restituer. */
  source: string;
}

export function MathFunctions({ math }: { math: MathConstructionApi }) {
  const { resolved } = useTheme();
  const { construction, selectObject } = math;

  // Le champ « Évaluer en x = » reste un état LOCAL : c'est une interrogation
  // passagère, pas un objet de la construction. La modéliser obligerait à lui
  // donner un identifiant, un genre et une durée de vie, pour une valeur que
  // personne ne voudrait retrouver dans la liste des objets.
  const [xSource, setXSource] = useState("1");

  const functions = useMemo(
    () => construction.objects.filter((object) => object.kind === "function"),
    [construction.objects]
  );

  const [plottedFunctions, flushPlot] = useDebounced(functions, 300);
  const [plottedX, flushX] = useDebounced(xSource, 300);

  // Un seul clavier pour tous les champs du panneau : il écrit dans celui
  // qui a le focus. Une référence, pas un état — changer de champ ne doit
  // pas provoquer de rendu.
  const handles = useRef(new Map<string, MathInputHandle>());
  const activeField = useRef<string | null>(null);

  function targetHandle(): MathInputHandle | null {
    const id = activeField.current ?? functions[0]?.id ?? null;
    return id === null ? null : handles.current.get(id) ?? null;
  }

  function addFunction() {
    if (functions.length >= MAX_CURVES) return;
    // L'identifiant est alloué par le modèle, puis l'objet est ajouté
    // immédiatement : entre les deux, personne d'autre ne peut le prendre.
    math.addObject({
      id: makeObjectId(construction, "function"),
      kind: "function",
      label: allocateLabel(construction.objects, "function"),
      // Vide, et non « x^2 » : la ligne naît en attente de saisie, ce que le
      // bouton « Ajouter » laissait déjà attendre.
      definition: "",
      dependencies: [],
      style: {
        color: allocateColor(construction.objects),
        width: 2,
      },
      visible: true,
    });
  }

  /**
   * Un clic sur le graphe désigne l'objet visé — ou vide la sélection.
   *
   * C'est le premier branchement de la sélection sur le DESSIN : le panneau de
   * propriétés reçoit alors le même identifiant que si la ligne avait été
   * cliquée dans la liste, parce qu'il n'y a qu'une sélection dans tout
   * l'espace de travail. Rien n'est retenu ici : ni l'objet survolé, ni le
   * dernier clic.
   */
  const handlePick = useCallback(
    (pick: CanvasPick) => {
      selectObject(pick.objectId);
    },
    [selectObject]
  );

  function removeFunction(id: string) {
    if (functions.length <= 1) return;
    handles.current.delete(id);
    math.removeObject(id);
  }

  // Compilation : chaque expression retardée est analysée UNE fois, pas à
  // chaque rendu. Elle sert au tableau de valeurs ET au message d'erreur.
  const compiledById = useMemo(() => {
    const map = new Map<string, CompiledFunction | null>();
    for (const object of plottedFunctions) {
      map.set(
        object.id,
        object.definition.trim() === "" ? null : compileFunction(object.definition)
      );
    }
    return map;
  }, [plottedFunctions]);

  const plottedCurves = useMemo<PlottedFunction[]>(
    () =>
      plottedFunctions.flatMap((object) => {
        const compiled = compiledById.get(object.id) ?? null;
        return compiled !== null && compiled.status === "ok"
          ? [
              {
                id: object.id,
                label: object.label ?? object.id,
                color: object.style.color ?? DEFAULT_OBJECT_COLOR,
                evaluate: compiled.evaluate,
                source: object.definition,
              },
            ]
          : [];
      }),
    [plottedFunctions, compiledById]
  );

  // Valeur de x demandée : on l'évalue avec le moteur, donc « pi/2 » marche.
  const xEvaluation = useMemo(
    () => (plottedX.trim() === "" ? null : evaluateConstant(plottedX)),
    [plottedX]
  );
  const xNumber = xEvaluation?.status === "ok" ? xEvaluation.approximateValue : null;
  // Une forme exacte pour f(x) n'a de sens que si x est entier : sinon
  // « exact » désignerait la valeur exacte du double arrondi, ce qui serait
  // une précision trompeuse.
  const xIsInteger = xNumber !== null && Number.isInteger(xNumber);

  return (
    <section className="app-card" aria-labelledby="math-fn-title">
      <header className="app-card-head">
        <div className="min-w-0">
          <h2 id="math-fn-title" className="app-card-title">
            <span className="inline-flex items-center gap-2">
              <Grid3x3 size={15} aria-hidden="true" />
              Fonctions
            </span>
          </h2>
          <p className="app-card-desc">
            Trace une ou plusieurs fonctions de x, zoome, déplace, et lis les valeurs
            correspondantes.
          </p>
        </div>
        <button
          type="button"
          className="app-btn app-btn-secondary shrink-0"
          onClick={addFunction}
          disabled={functions.length >= MAX_CURVES}
          title={
            functions.length >= MAX_CURVES
              ? `${MAX_CURVES} courbes au maximum`
              : "Ajouter une courbe"
          }
        >
          <Plus size={14} aria-hidden="true" />
          Ajouter
        </button>
      </header>

      <div className="app-card-body flex flex-col gap-4">
        <ul className="flex flex-col gap-3">
          {functions.map((object) => {
            const result = compiledById.get(object.id) ?? null;
            const errorMessage =
              result !== null && result.status === "error" ? result.message : null;
            const name = object.label ?? object.id;
            const color = object.style.color ?? DEFAULT_OBJECT_COLOR;

            return (
              <li key={object.id} className="flex items-end gap-2">
                <span
                  className="app-mono mb-2.5 shrink-0 text-[15px] font-semibold"
                  style={{ color }}
                  aria-hidden="true"
                >
                  {name}(x) =
                </span>
                <div className="min-w-0 flex-1">
                  <MathInput
                    ref={(handle) => {
                      if (handle) handles.current.set(object.id, handle);
                      else handles.current.delete(object.id);
                    }}
                    fieldId={`math-fn-${object.id}`}
                    label={`Expression de ${name}`}
                    value={object.definition}
                    onChange={(next) => math.updateObject(object.id, { definition: next })}
                    onSubmit={flushPlot}
                    errorMessage={errorMessage}
                    placeholder="x^2 - 1"
                    size="sm"
                    onFieldFocus={() => {
                      activeField.current = object.id;
                    }}
                  />
                </div>
                {!object.visible && (
                  <span className="app-badge app-badge-amber mb-2 shrink-0">masquée</span>
                )}
                <button
                  type="button"
                  className="app-icon-btn mb-0.5 shrink-0"
                  onClick={() => removeFunction(object.id)}
                  disabled={functions.length <= 1}
                  aria-label={`Supprimer la courbe ${name}`}
                  title={
                    functions.length <= 1
                      ? "Au moins une courbe est nécessaire"
                      : "Supprimer"
                  }
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>

        <MathKeyboard
          onInsert={(text, caretBack) => targetHandle()?.insert(text, caretBack)}
          onBackspace={() => targetHandle()?.backspace()}
          onClear={() => targetHandle()?.clear()}
          onSubmit={flushPlot}
        />
        <MathKeyboardHints />

        <MathGraph
          construction={construction}
          ordering={math.resolved}
          geometry={math.geometry}
          theme={resolved}
          title="Graphe des fonctions"
          onResetView={() => math.setView(DEFAULT_VIEW)}
          onPick={handlePick}
        />

        <div className="app-card overflow-hidden">
          <header className="app-card-head">
            <h3 className="app-card-title">Tableau de valeurs</h3>
          </header>
          <div className="overflow-x-auto">
            <table className="app-table">
              <caption className="sr-only">
                Valeurs des fonctions tracées pour x entier de −3 à 3
              </caption>
              <thead>
                <tr>
                  <th scope="col">x</th>
                  {plottedCurves.map((curve) => (
                    <th key={curve.id} scope="col">
                      <span className="app-mono">{curve.label}(x)</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TABLE_X.map((x) => (
                  <tr key={x}>
                    <th scope="row" className="app-mono" style={{ textTransform: "none" }}>
                      {x}
                    </th>
                    {plottedCurves.map((curve) => (
                      <td key={curve.id} className="app-mono">
                        {formatTableValue(curve.evaluate(x))}
                      </td>
                    ))}
                  </tr>
                ))}
                {xNumber !== null && (
                  <tr>
                    <th scope="row" className="app-mono" style={{ textTransform: "none" }}>
                      {xEvaluation?.status === "ok" && xEvaluation.exact !== null
                        ? xEvaluation.exact
                        : formatApproximate(xNumber)}
                    </th>
                    {plottedCurves.map((curve) => {
                      const at = evaluateAt(curve.source, xNumber);
                      if (at.status === "error") {
                        return (
                          <td key={curve.id} className="app-mono">
                            —
                          </td>
                        );
                      }
                      return (
                        <td key={curve.id} className="app-mono">
                          {xIsInteger && at.exact !== null
                            ? at.exact
                            : formatTableValue(at.approximateValue)}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <MathInput
              ref={(handle) => {
                if (handle) handles.current.set("__x", handle);
                else handles.current.delete("__x");
              }}
              fieldId="math-fn-x"
              label="Évaluer en x ="
              value={xSource}
              onChange={setXSource}
              onSubmit={flushX}
              errorMessage={
                xEvaluation !== null && xEvaluation.status === "error"
                  ? xEvaluation.message
                  : null
              }
              placeholder="1"
              size="sm"
              onFieldFocus={() => {
                activeField.current = "__x";
              }}
            />
          </div>
          <button type="button" className="app-btn app-btn-secondary" onClick={flushX}>
            Évaluer
          </button>
        </div>

        {xEvaluation !== null && xEvaluation.status === "ok" && (
          <p className="text-[12.5px]" style={{ color: "var(--app-text-muted)" }}>
            Ligne ajoutée au tableau pour{" "}
            <span className="app-mono">
              x = {xEvaluation.exact ?? formatApproximate(xEvaluation.approximateValue)}
            </span>
            {xEvaluation.exact !== null && xEvaluation.exact !== xEvaluation.approximate && (
              <span className="app-mono"> ≈ {xEvaluation.approximate}</span>
            )}
            . {!xIsInteger && "x n'est pas entier : seule la valeur approchée est affichée."}
          </p>
        )}
      </div>
    </section>
  );
}
