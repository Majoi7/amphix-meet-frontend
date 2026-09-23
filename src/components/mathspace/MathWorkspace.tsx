import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layers, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { evaluateConstant, type Evaluation } from "../../lib/math";
import { objectName } from "../../lib/math/geometry";
import { solveEquation, type EquationResult } from "../../lib/math/solve";
// Les jetons de thème d'abord, les recettes de l'espace mathématique
// ensuite. Les deux sont importés ICI, par le module qui porte ces classes :
// où que l'espace de travail soit monté, son apparence suit.
import "../../styles/theme.css";
import "./mathspace.css";
import { MathCalculator } from "./MathCalculator";
import { MathEquations } from "./MathEquations";
import { MathFunctions } from "./MathFunctions";
import { MathGeometry } from "./MathGeometry";
import { MathHistory } from "./MathHistory";
import { MathObjectList } from "./MathObjectList";
import { MathPropertiesPanel } from "./MathPropertiesPanel";
import { MathLimits, MathToolTabs, TOOL_PANEL_ID, type MathToolId } from "./MathTools";
import { MathSpaceLayoutContext, useCompactLayout } from "./mathspaceLayout";
import { isTypingTarget } from "./mathspaceKeys";
import { useMathConstruction } from "./useMathConstruction";
import { useMathHistory, type MathHistoryEntry } from "./useMathHistory";

/**
 * Espace de travail mathématique — le cœur réutilisable.
 *
 * Il ne contient AUCUNE coquille de page (ni en-tête, ni barre latérale, ni
 * fond) : c'est ce qui permet de le monter aussi bien dans l'espace
 * d'administration que dans une page autonome, sans dupliquer le code.
 *
 * DEUX DISPOSITIONS, UN SEUL ARBRE
 *
 * Sur un conteneur assez large, l'écran se lit comme celui d'un logiciel de
 * mathématiques : la CONSTRUCTION à gauche, le TRAVAIL au centre, les
 * PROPRIÉTÉS à droite. Le graphe occupe la colonne du milieu, la plus large.
 *
 * Sur un conteneur étroit, la même matière s'empile dans l'ordre où on s'en
 * sert : le TRAVAIL d'abord — le graphe reste immédiatement accessible —, puis
 * un sélecteur, puis UN panneau à la fois. Trois colonnes dans 360 px ne
 * donneraient qu'un graphe écrasé entre deux listes.
 *
 * Les deux dispositions rendent les MÊMES enfants dans le MÊME ordre : seules
 * les classes changent. Un arbre qui se déplacerait d'une disposition à
 * l'autre remonterait le graphe à chaque bascule — donc détruirait le plateau
 * JSXGraph, et avec lui le zoom en cours, pour un simple changement de largeur.
 * C'est aussi ce qui impose que l'ordre du DOM soit celui du petit écran, et
 * que `order-*` ne serve qu'à réarranger sur grand écran.
 *
 * C'est ICI que vit la construction mathématique — le modèle objet qui est
 * désormais la source de vérité de tout l'espace. Elle est montée avec lui et
 * lui survit à tout ce qui est en dessous : changer d'onglet démonte le
 * panneau et le graphe, la construction reste. Le rendu est donc
 * reconstructible à volonté, ce qui est exactement la propriété recherchée.
 *
 * Ce qui reste local à ce composant, et pourquoi :
 *
 *  - l'outil actif : c'est une préférence d'affichage, pas un objet
 *    mathématique ;
 *  - l'expression et l'équation en cours de saisie : ce sont les brouillons de
 *    la calculatrice et du solveur. Ils ne deviennent des objets de la
 *    construction que le jour où ces outils sauront en produire — les y mettre
 *    aujourd'hui créerait des objets que rien ne saurait tracer ni relire ;
 *  - l'historique : il est déjà persisté par `useMathHistory`, qui garde son
 *    propre format et sa propre clé de stockage. Le fondre dans la
 *    construction casserait les historiques existants sans rien apporter ;
 *  - le panneau choisi sur petit écran : c'est un état de présentation, sans
 *    rapport avec la construction.
 */
export function MathWorkspace() {
  const [tool, setTool] = useState<MathToolId>("calculatrice");

  const [expression, setExpression] = useState("");
  const [result, setResult] = useState<Evaluation | null>(null);

  const [equation, setEquation] = useState("");
  const [equationResult, setEquationResult] = useState<EquationResult | null>(null);

  /** Sur petit écran, quel panneau secondaire est déplié. */
  const [sidePanel, setSidePanel] = useState<SidePanelId>("objets");

  // La disposition se décide sur la largeur RÉELLEMENT offerte à cet élément —
  // jamais sur `window.innerWidth`, qui ignorerait la barre latérale de
  // l'administration comme la largeur du conteneur dans une page d'accueil.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const compact = useCompactLayout(rootRef);

  const math = useMathConstruction();
  const { construction, resolved, geometry } = math;

  /**
   * Les deux façons dont un objet peut ne pas être rendable, réunies.
   *
   * Elles restent DISTINCTES dans le modèle — une dépendance manquante n'est
   * pas une géométrie impossible — mais la liste et le panneau n'ont pas à
   * connaître cette nuance : ce qu'ils affichent, c'est « cet objet ne peut pas
   * être tracé », avec la raison qui convient.
   */
  const invalid = useMemo(() => {
    if (resolved.blocked.size === 0) return geometry.invalid;

    // Les membres d'un cycle sont nommés par l'issue correspondante ; les
    // autres objets bloqués le sont par ricochet, et leur cause est une
    // dépendance manquante, la leur ou celle d'un objet en amont.
    const cycleIds = new Set<string>();
    for (const issue of resolved.issues) {
      if (issue.kind === "cycle") for (const id of issue.references) cycleIds.add(id);
    }
    const ownMissing = new Set<string>();
    for (const issue of resolved.issues) {
      if (issue.kind === "missing") ownMissing.add(issue.objectId);
    }

    const merged = new Map(geometry.invalid);
    for (const id of resolved.blocked) {
      if (merged.has(id)) continue;
      if (cycleIds.has(id)) {
        merged.set(
          id,
          "Cet objet dépend de lui-même, directement ou par une chaîne d'autres objets."
        );
      } else if (ownMissing.has(id)) {
        merged.set(id, "Cet objet cite une dépendance qui n'existe pas.");
      } else {
        merged.set(id, "Cet objet dépend d'un objet qui ne peut pas être tracé.");
      }
    }
    return merged;
  }, [geometry.invalid, resolved]);

  const history = useMathHistory();

  const selectedObjectId = construction.selection.selectedObjectId;

  /**
   * Le nom de l'objet sélectionné, s'il y en a un.
   *
   * Il ne sert qu'à l'étiquette du panneau « Propriétés » sur petit écran, où
   * ce panneau n'est pas visible : sans cet indice, sélectionner un objet dans
   * la liste ne montrerait RIEN changer à l'écran, et rien n'indiquerait où
   * aller pour l'éditer. Il se lit sur `construction.selection`, comme partout
   * ailleurs — il n'existe toujours pas de second `selectedObjectId`.
   */
  const selectedName = useMemo(() => {
    if (selectedObjectId === null) return null;
    const object = construction.objects.find((item) => item.id === selectedObjectId);
    return object ? objectName(object) : null;
  }, [construction.objects, selectedObjectId]);

  /**
   * « Suppr » et « Retour arrière » suppriment l'objet sélectionné.
   *
   * C'est le geste que la corbeille de la liste fait déjà, atteint au clavier :
   * même opération, même point d'entrée (`removeObject`), donc même cascade.
   * Les deux touches sont acceptées parce que les deux sont naturelles, et
   * qu'aucune ne sert à autre chose ici.
   *
   * La garde sur le champ de saisie n'est pas un détail : sans elle, écrire un
   * nom d'objet dans le panneau de droite le supprimerait à la première
   * correction.
   */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (isTypingTarget(event.target)) return;
      if (selectedObjectId === null) return;
      // Sur une page qui défile, « Retour arrière » remonte d'un cran dans
      // l'historique du navigateur sous certains navigateurs : on le retient.
      event.preventDefault();
      math.removeObject(selectedObjectId);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedObjectId, math.removeObject]);

  const calculate = useCallback(() => {
    const evaluation = evaluateConstant(expression);
    setResult(evaluation);
    // On n'enregistre que ce qui a réellement produit un résultat : une
    // ligne d'historique qui ne mène nulle part ne sert à rien.
    if (evaluation.status === "ok") {
      history.record(
        "calcul",
        evaluation.source,
        evaluation.exact ?? evaluation.approximate
      );
    }
  }, [expression, history]);

  const solve = useCallback(() => {
    const solution = solveEquation(equation);
    setEquationResult(solution);
    if (solution.status === "solved") {
      history.record(
        "equation",
        equation,
        solution.solutions.map((item) => `x = ${item.exact}`).join("   ou   ")
      );
    }
  }, [equation, history]);

  /** Reprend une opération passée : l'expression revient dans son outil, et
   *  le résultat est recalculé tout de suite — pas besoin de revalider. */
  const reuse = useCallback((entry: MathHistoryEntry) => {
    if (entry.kind === "equation") {
      setEquation(entry.source);
      setEquationResult(solveEquation(entry.source));
      setTool("equations");
      return;
    }
    setExpression(entry.source);
    setResult(evaluateConstant(entry.source));
    setTool("calculatrice");
  }, []);

  // Sur grand écran, les deux panneaux sont visibles et le sélecteur disparaît.
  const showObjects = !compact || sidePanel === "objets";
  const showProperties = !compact || sidePanel === "proprietes";

  /**
   * Colonnes latérales ÉLASTIQUES : `minmax(176px, 205px)` et non `205px`.
   * Avec des largeurs fixes, la colonne du milieu se réduirait à une vignette
   * dès que le conteneur se resserre ; avec un minimum, ce sont les panneaux
   * qui se resserrent, et le graphe qui garde la plus grande part. Le seuil de
   * bascule vers la disposition empilée est calculé sur ces 404 px de minima
   * (voir `mathspaceLayout.ts`).
   *
   * `sticky` n'est appliqué QUE sur grand écran : empilé, un panneau collant
   * recouvrirait le graphe au défilement.
   */
  const wideGrid =
    "grid min-w-0 items-start gap-4 grid-cols-[minmax(176px,205px)_minmax(0,1fr)_minmax(196px,265px)]";
  const sideColumnWide = "sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto";

  return (
    <MathSpaceLayoutContext.Provider value={compact}>
      <div ref={rootRef} className="flex min-w-0 flex-col gap-4">
        <MathToolTabs active={tool} onChange={setTool} />

        <div className={compact ? "flex min-w-0 flex-col gap-4" : wideGrid}>
          {/* ── Le travail : le graphe, ou l'outil qui n'en a pas ───────── */}
          <div
            id={TOOL_PANEL_ID}
            role="tabpanel"
            aria-labelledby={`mathspace-tab-${tool}`}
            tabIndex={-1}
            className={compact ? "min-w-0" : "min-w-0 order-2"}
          >
            {tool === "calculatrice" && (
              <MathCalculator
                expression={expression}
                onExpressionChange={setExpression}
                result={result}
                onCalculate={calculate}
              />
            )}
            {tool === "fonctions" && <MathFunctions math={math} />}
            {tool === "geometrie" && <MathGeometry math={math} />}
            {tool === "equations" && (
              <MathEquations
                equation={equation}
                onEquationChange={setEquation}
                result={equationResult}
                onSolve={solve}
              />
            )}
            {tool === "limites" && <MathLimits />}
          </div>

          {/*
            Le sélecteur est TOUJOURS monté, et masqué sur grand écran.

            Le masquage est porté par cette enveloppe, PAS par le sélecteur
            lui-même : `app-tablist` déclare `display: flex`, et `hidden`
            déclare `display: none`. Les deux ont la même spécificité — une
            seule classe — donc c'est l'ordre du fichier CSS final qui
            trancherait, et cet ordre dépend de l'ordre d'import des feuilles,
            pas d'une intention. Une enveloppe sans recette de disposition ne
            court-circuite pas ce hasard.

            Le garder monté plutôt que `{compact && …}` a deux raisons : la
            liste des enfants garde la même forme dans les deux dispositions,
            et le `tablist` ne perd ni son focus ni son état de défilement
            quand la fenêtre change de largeur.
          */}
          <div className={compact ? "min-w-0" : "hidden"}>
            <SidePanelSwitcher
              active={sidePanel}
              onChange={setSidePanel}
              objectCount={construction.objects.length}
              selectedName={selectedName}
            />
          </div>

          {/* ── La construction ─────────────────────────────────────────── */}
          <div
            id="mathspace-panel-objets"
            role={compact ? "tabpanel" : undefined}
            aria-labelledby={compact ? "mathspace-panel-tab-objets" : undefined}
            className={[
              "min-w-0 flex-col gap-4",
              compact ? "" : "order-1",
              showObjects ? "flex" : "hidden",
              compact ? "" : sideColumnWide,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <MathObjectList
              construction={construction}
              blocked={resolved.blocked}
              invalid={invalid}
              onSelect={math.toggleObjectSelection}
              onRemove={math.removeObject}
              onToggleVisibility={math.setObjectVisibility}
            />
          </div>

          {/* ── Les propriétés de ce qui est sélectionné ────────────────── */}
          <div
            id="mathspace-panel-proprietes"
            role={compact ? "tabpanel" : undefined}
            aria-labelledby={compact ? "mathspace-panel-tab-proprietes" : undefined}
            className={[
              "min-w-0 flex-col gap-4",
              compact ? "" : "order-3",
              showProperties ? "flex" : "hidden",
              compact ? "" : sideColumnWide,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <MathPropertiesPanel
              construction={construction}
              invalid={invalid}
              onUpdateStyle={math.updateObjectStyle}
              onUpdateObject={math.updateObject}
              onSetVisibility={math.setObjectVisibility}
            />
            <MathHistory
              entries={history.entries}
              onReuse={reuse}
              onRemove={history.remove}
              onClear={history.clear}
            />
          </div>
        </div>
      </div>
    </MathSpaceLayoutContext.Provider>
  );
}

// ── Le sélecteur de panneaux, sur petit écran ─────────────────────────────

type SidePanelId = "objets" | "proprietes";

/**
 * Deux panneaux, un à la fois.
 *
 * C'est un vrai `tablist` : une seule tabulation pour entrer dans le groupe,
 * les flèches pour passer d'un panneau à l'autre, et `aria-controls` qui
 * désigne la région réellement affichée. Le `tabIndex` mobile est le même que
 * celui des onglets d'outils — l'espace se navigue donc de la même façon en
 * haut et en bas de l'écran.
 *
 * L'historique reste avec les propriétés : c'est un journal de ce qu'on a
 * édité, pas un troisième panneau à consulter en parallèle.
 */
function SidePanelSwitcher({
  active,
  onChange,
  objectCount,
  selectedName,
}: {
  active: SidePanelId;
  onChange: (next: SidePanelId) => void;
  objectCount: number;
  /** Nom de l'objet sélectionné, ou `null` — voir `selectedName`. */
  selectedName: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const items: { id: SidePanelId; label: string; Icon: LucideIcon }[] = [
    { id: "objets", label: `Objets (${objectCount})`, Icon: Layers },
    {
      id: "proprietes",
      label: selectedName === null ? "Propriétés" : `Propriétés · ${selectedName}`,
      Icon: SlidersHorizontal,
    },
  ];

  const activeIndex = items.findIndex((item) => item.id === active);

  function moveFocus(index: number) {
    containerRef.current
      ?.querySelectorAll<HTMLButtonElement>("[role='tab']")
      [index]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const handled = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!handled.includes(event.key)) return;
    event.preventDefault();

    let next = activeIndex;
    if (event.key === "ArrowRight") next = (activeIndex + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (activeIndex - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else next = items.length - 1;

    if (next === activeIndex) return;
    onChange(items[next].id);
    moveFocus(next);
  }

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label="Panneaux de l'espace mathématique"
      onKeyDown={handleKeyDown}
      className="app-tablist"
    >
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`mathspace-panel-tab-${item.id}`}
            aria-selected={isActive}
            aria-controls={`mathspace-panel-${item.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.id)}
            className="app-tab"
          >
            <item.Icon size={15} aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
