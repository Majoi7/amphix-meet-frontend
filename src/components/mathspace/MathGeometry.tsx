import { useEffect, useMemo, useRef, useState } from "react";
import {
  Info,
  MousePointer2,
  Shapes,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  DEFAULT_VIEW,
  type MathConstruction,
  type MathObject,
} from "../../lib/math/construction";
import {
  circleBetween,
  circleToWorld,
  intersectShapes,
  intersectionObjects,
  lineBetween,
  lineToWorld,
  objectName,
  pointObject,
  segmentBetween,
  segmentToWorld,
  type WorldPoint,
} from "../../lib/math/geometry";
import { useTheme } from "../../context/ThemeContext";
import { MathGraph, type CanvasPick } from "./MathGraph";
import { OBJECT_ICONS } from "./mathObjectIcons";
import { useMathSpaceLayout } from "./mathspaceLayout";
import { isTypingTarget } from "./mathspaceKeys";
import { revealHorizontally } from "./revealInScroll";
import type { MathConstructionApi } from "./useMathConstruction";

/**
 * Onglet Géométrie : construire des figures, et rien d'autre.
 *
 * CET ONGLET NE DÉTIENT AUCUN OBJET
 *
 * Tout ce qu'il crée passe par `math.addObjects`, donc par le modèle. Il ne
 * garde en mémoire que deux choses, et aucune n'est un objet mathématique :
 *
 *  - l'outil actif, qui est une préférence d'affichage ;
 *  - le premier appui d'une construction en deux temps, qui est un identifiant
 *    vers un objet DÉJÀ créé. Un segment à moitié construit n'est pas un objet
 *    mathématique : le garder dans le modèle y ferait vivre une figure
 *    incomplète que rien ne saurait ni tracer ni sélectionner.
 *
 * Le point du premier appui, lui, est créé immédiatement — il existe donc dans
 * la construction avant d'être cité par qui que ce soit. C'est la règle :
 * aucun objet ne peut dépendre d'un identifiant qui ne désigne rien.
 *
 * CE QUE CET ONGLET NE FAIT PAS
 *
 * Il n'affiche ni la liste des objets ni leurs propriétés : elles vivent dans
 * les colonnes latérales, communes à tous les outils. Une figure créée ici est
 * donc immédiatement sélectionnable, masquable et supprimable là-bas, sans
 * qu'une seule ligne de code ne soit partagée entre les deux. C'est ce qui
 * garde la liste des objets hors du métier de construction.
 *
 * LA CONSIGNE EST DÉCOUPÉE EN ÉTAPES
 *
 * `steps` dit ce qu'on attend AVANT le premier appui, puis après. C'est du
 * texte, rien de plus : la vérité de l'avancement reste `pending`, et la
 * géométrie reste dans `geometry.ts`. L'interface se contente de RACONTER ce
 * que le modèle est en train de faire — elle ne le décide jamais.
 */

type GeometryToolId =
  | "selection"
  | "point"
  | "segment"
  | "droite"
  | "cercle"
  | "intersection";

/** Outils qui se construisent en DEUX appuis. */
type TwoStepToolId = "segment" | "droite" | "cercle";

interface ToolDef {
  id: GeometryToolId;
  label: string;
  Icon: LucideIcon;
  /**
   * Consigne, indexée sur le nombre d'appuis DÉJÀ donnés : `steps[0]` tant
   * qu'aucun objet n'est retenu, `steps[1]` ensuite. Un outil d'un seul geste
   * n'a qu'une entrée — l'index est borné, il n'y a donc rien à traiter à part.
   */
  steps: readonly string[];
  hint: string;
}

const TOOLS: ToolDef[] = [
  {
    id: "selection",
    label: "Sélection",
    Icon: MousePointer2,
    steps: [
      "Clique un objet pour le sélectionner, ou dans le vide pour relâcher la sélection.",
    ],
    hint: "Clique un objet pour le sélectionner. Ses propriétés apparaissent dans la colonne de droite.",
  },
  {
    id: "point",
    label: "Point",
    Icon: OBJECT_ICONS.point,
    steps: ["Clique à l'endroit où poser un point. L'outil reste actif : enchaîne les points."],
    hint: "Clique sur le graphique pour poser un point. L'outil reste actif : enchaîne les points.",
  },
  {
    id: "segment",
    label: "Segment",
    Icon: OBJECT_ICONS.segment,
    steps: [
      "1. Sélectionne le premier point — un point déjà là est réutilisé, sinon il est créé ici.",
      "2. Sélectionne le second point.",
    ],
    hint: "Clique deux points pour tracer un segment. Un point déjà là est réutilisé.",
  },
  {
    id: "droite",
    label: "Droite",
    Icon: OBJECT_ICONS.line,
    steps: [
      "1. Sélectionne un premier point de la droite.",
      "2. Sélectionne un second point : la droite passera par eux et se prolongera à l'infini.",
    ],
    hint: "Clique deux points : la droite passe par eux et se prolonge à l'infini.",
  },
  {
    id: "cercle",
    label: "Cercle",
    Icon: OBJECT_ICONS.circle,
    steps: [
      "1. Sélectionne le centre.",
      "2. Sélectionne un point du cercle : le rayon est la distance entre les deux.",
    ],
    hint: "Clique le centre, puis un point du cercle : le rayon est la distance entre les deux.",
  },
  {
    id: "intersection",
    label: "Intersection",
    Icon: OBJECT_ICONS.intersection,
    steps: [
      "1. Sélectionne un premier segment, droite ou cercle.",
      "2. Sélectionne un second objet : chaque point commun deviendra un objet.",
    ],
    hint: "Clique deux objets qui se coupent. Chaque point commun devient un objet à part entière.",
  },
];

/** Les figures proposées à une construction encore vide. Ce sont les mêmes
 *  outils que la barre, désignés par leur identifiant : aucune logique en
 *  double, seulement un second chemin vers les mêmes gestes. */
const QUICK_TOOL_IDS: readonly GeometryToolId[] = [
  "point",
  "segment",
  "droite",
  "cercle",
];

/** Message passager sous la barre d'outils — jamais un objet du modèle. */
interface Notice {
  tone: "info" | "error";
  text: string;
}

export function MathGeometry({ math }: { math: MathConstructionApi }) {
  const { resolved } = useTheme();
  const { construction, geometry } = math;

  const [tool, setTool] = useState<GeometryToolId>("selection");
  /** Identifiants déjà désignés pour l'outil en cours. */
  const [pending, setPending] = useState<string[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);

  function chooseTool(next: GeometryToolId) {
    if (next === tool) return;
    setTool(next);
    // Une construction à moitié engagée n'a plus de sens sous un autre outil.
    setPending([]);
    setNotice(null);
  }

  /**
   * Échap annule ce qui est engagé, puis rend la main à la sélection.
   *
   * L'écoute est posée sur la FENÊTRE : après avoir cliqué sur le graphique,
   * l'utilisateur n'a le focus sur rien, et un raccourci qu'il faudrait aller
   * viser sur un bouton ne servirait à rien. Elle est retirée au démontage —
   * quitter l'onglet Géométrie doit rendre Échap au reste de la page.
   */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Échap dans un champ de saisie appartient au champ (une infobulle, une
      // liste déroulante) : il ne doit pas aussi changer d'outil.
      if (isTypingTarget(event.target)) return;

      if (pending.length > 0) {
        setPending([]);
        setNotice(null);
        return;
      }
      if (tool !== "selection") {
        setTool("selection");
        setNotice(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pending, tool]);

  /**
   * L'objet visé, s'il s'agit bien d'un POINT.
   *
   * La question est posée à la géométrie RÉSOLUE, et non au genre déclaré :
   * une intersection est un point pour la géométrie, même si son genre est
   * « intersection ». Elle est donc utilisable comme extrémité de segment, ce
   * qui est exactement ce qu'on attend d'un point d'intersection.
   */
  function pickedPointId(pick: CanvasPick): string | null {
    if (pick.objectId === null) return null;
    return geometry.shapes.get(pick.objectId)?.kind === "point"
      ? pick.objectId
      : null;
  }

  function nameOf(id: string): string {
    const object = construction.objects.find((item) => item.id === id);
    return object ? objectName(object) : id;
  }

  // Aucune mémoïsation : ces fonctions lisent l'état courant du composant, et
  // le graphe relit la dernière version après chaque rendu. Un `useCallback`
  // aux dépendances fuyantes donnerait ici une fausse impression de stabilité.

  function handlePick(pick: CanvasPick) {
    if (tool === "selection") {
      math.selectObject(pick.objectId);
      setNotice(null);
      return;
    }
    if (tool === "point") {
      math.addObjects(pointObject(construction, pick.world));
      setNotice(null);
      return;
    }
    if (tool === "intersection") {
      handleIntersectionPick(pick);
      return;
    }
    handleTwoStepPick(tool, pick);
  }

  /** Un appui sur un support à couper : on en garde deux, puis on calcule. */
  function handleIntersectionPick(pick: CanvasPick) {
    const targetId = pick.objectId;
    if (targetId === null) {
      setNotice({ tone: "info", text: "Clique sur un segment, une droite ou un cercle." });
      return;
    }

    const shape = geometry.shapes.get(targetId);
    if (!shape || shape.kind === "point" || shape.kind === "function") {
      setNotice({
        tone: "error",
        text: "Cet objet n'a pas de support à couper : choisis un segment, une droite ou un cercle.",
      });
      return;
    }

    if (pending.length === 0) {
      setPending([targetId]);
      setNotice({
        tone: "info",
        text: `${nameOf(targetId)} retenu. Clique le second objet.`,
      });
      return;
    }

    const firstId = pending[0];

    // Les refus ci-dessous CONSERVENT le premier appui : l'utilisateur n'a
    // qu'un second clic à faire pour se rattraper, sans tout recommencer.
    if (firstId === targetId) {
      setNotice({ tone: "error", text: "Choisis deux objets différents." });
      return;
    }

    const firstShape = geometry.shapes.get(firstId);
    if (!firstShape) {
      setPending([]);
      setNotice({
        tone: "error",
        text: "Le premier objet a été supprimé entre-temps. Recommence.",
      });
      return;
    }

    const result = intersectShapes(firstShape, shape);
    if (result.status !== "ok") {
      // Zéro solution, ou une infinité : dans les deux cas il n'y a pas de
      // point à créer, et la raison est DITE plutôt que devinée.
      setNotice({ tone: "error", text: result.reason });
      return;
    }

    math.addObjects(intersectionObjects(construction, firstId, targetId, result.points));
    setPending([]);
    setNotice({
      tone: "info",
      text:
        result.points.length > 1
          ? `${result.points.length} points d'intersection créés, un objet chacun.`
          : "Un point d'intersection créé.",
    });
  }

  /** Segment, droite ou cercle : deux appuis, dans cet ordre. */
  function handleTwoStepPick(current: TwoStepToolId, pick: CanvasPick) {
    const existing = pickedPointId(pick);

    // ── Premier appui ──
    if (pending.length === 0) {
      // Un point déjà là est réutilisé ; sinon il est créé MAINTENANT, pour
      // exister dans la construction avant que le second appui ne le cite.
      if (existing) {
        setPending([existing]);
        setNotice({
          tone: "info",
          text: `${nameOf(existing)} retenu. Clique le second point.`,
        });
        return;
      }
      const created = pointObject(construction, pick.world);
      math.addObjects(created);
      setPending([created[0].id]);
      setNotice({ tone: "info", text: "Premier point posé. Clique le second." });
      return;
    }

    // ── Second appui ──
    const firstId = pending[0];

    if (!construction.objects.some((object) => object.id === firstId)) {
      setPending([]);
      setNotice({
        tone: "error",
        text: "Le premier point a été supprimé entre-temps. Recommence.",
      });
      return;
    }

    if (existing !== null) {
      if (existing === firstId) {
        // Le premier appui est conservé : il suffit de cliquer ailleurs.
        setNotice({
          tone: "error",
          text: "Il faut deux points distincts : avec deux extrémités confondues, la direction n'est pas définie.",
        });
        return;
      }
      math.addObjects(betweenObjects(current, construction, firstId, existing));
      setPending([]);
      setNotice(null);
      return;
    }

    math.addObjects(toWorldObjects(current, construction, firstId, pick.world));
    setPending([]);
    setNotice(null);
  }

  const activeTool = TOOLS.find((item) => item.id === tool) ?? TOOLS[0];

  // La consigne affichée est celle de l'étape EN COURS. L'index est borné :
  // un outil d'un seul geste garde la même phrase du début à la fin.
  const stepText =
    activeTool.steps[Math.min(pending.length, activeTool.steps.length - 1)];

  /**
   * Y a-t-il une FIGURE à montrer ?
   *
   * La construction d'ouverture contient une courbe d'exemple : « vide » ne
   * peut donc pas vouloir dire « aucun objet ». Ce qu'on accueille ici, c'est
   * l'absence de tout objet géométrique — le moment où l'onglet ne montre
   * qu'une courbe et aucune construction, et où il faut dire par où commencer.
   */
  const hasFigure = useMemo(
    () =>
      construction.objects.some(
        (object) =>
          object.kind === "point" ||
          object.kind === "segment" ||
          object.kind === "line" ||
          object.kind === "circle" ||
          object.kind === "intersection"
      ),
    [construction.objects]
  );

  /**
   * Sur petit écran, la barre d'outils DÉFILE au lieu de se replier.
   *
   * Six outils avec leur libellé tiennent sur trois rangées dans 360 px, soit
   * une centaine de pixels pris au graphe — précisément ce que le passage au
   * mobile doit éviter. Une seule rangée qui défile garde la hauteur de la
   * barre constante, et conserve les libellés : un doigt ne survole pas, donc
   * une infobulle n'y serait jamais lue, et une icône seule serait devinée.
   */
  const compact = useMathSpaceLayout();
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  /**
   * Ramène l'outil actif dans le champ VISIBLE de la barre.
   *
   * Ce n'est pas un confort : l'accueil d'une construction vide propose des
   * raccourcis qui arment un outil sans que la barre ait été touchée. Si
   * l'outil armé est hors du champ, l'état de la barre contredit celui de
   * l'espace, et rien ne dit à l'utilisateur ce qui est actif.
   */
  useEffect(() => {
    if (!compact) return;
    const container = toolbarRef.current;
    revealHorizontally(
      container,
      container?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? null
    );
  }, [compact, tool]);

  return (
    <section className="app-card" aria-labelledby="math-geometry-title">
      <header className="app-card-head">
        <div className="min-w-0">
          <h2 id="math-geometry-title" className="app-card-title">
            <span className="inline-flex items-center gap-2">
              <Shapes size={15} aria-hidden="true" />
              Géométrie
            </span>
          </h2>
          <p className="app-card-desc">
            Construis des points, des segments, des droites et des cercles. Chaque
            figure devient un objet de la construction : tu la retrouves dans la
            liste, où tu peux la renommer, la colorer, la masquer ou la supprimer.
          </p>
        </div>
      </header>

      <div className="app-card-body flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div
            ref={toolbarRef}
            role="toolbar"
            aria-label="Outils de géométrie"
            aria-orientation="horizontal"
            className={compact ? "app-toolbar app-toolbar-scroll" : "app-toolbar"}
          >
            {TOOLS.map((item) => {
              const active = item.id === tool;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => chooseTool(item.id)}
                  aria-pressed={active}
                  title={item.hint}
                  className="app-tool"
                >
                  <item.Icon size={14} aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <p
            className="m-0 text-[12.5px]"
            style={{ color: "var(--app-text-muted)" }}
            aria-live="polite"
          >
            {stepText}
          </p>

          {pending.length > 0 && (
            <p className="app-mono m-0 text-[12px]" style={{ color: "var(--app-text-subtle)" }}>
              En attente : {pending.map(nameOf).join(", ")}
            </p>
          )}

          <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]" style={{ color: "var(--app-text-subtle)" }}>
            <span>
              <span className="app-kbd">Échap</span> annule la construction en cours.
            </span>
            <span>
              <span className="app-kbd">Suppr</span> supprime l&apos;objet sélectionné.
            </span>
          </p>
        </div>

        {notice && (
          <p
            className="m-0 flex items-start gap-2 rounded-md px-2.5 py-1.5 text-[12.5px]"
            style={{
              backgroundColor: "var(--app-surface-2)",
              color: "var(--app-text-muted)",
            }}
            role="status"
          >
            {notice.tone === "error" ? (
              <TriangleAlert
                size={14}
                aria-hidden="true"
                className="mt-0.5 shrink-0"
                style={{ color: "var(--app-accent-strong)" }}
              />
            ) : (
              <Info
                size={14}
                aria-hidden="true"
                className="mt-0.5 shrink-0"
                style={{ color: "var(--app-text-subtle)" }}
              />
            )}
            <span>{notice.text}</span>
          </p>
        )}

        <MathGraph
          construction={construction}
          ordering={math.resolved}
          geometry={geometry}
          theme={resolved}
          title="Graphe de géométrie"
          onResetView={() => math.setView(DEFAULT_VIEW)}
          onPick={handlePick}
          hint={activeTool.hint}
          overlay={
            // L'accueil s'efface dès qu'un outil de construction est choisi,
            // et non seulement à la première figure : sinon il resterait posé
            // au milieu du graphique pendant tout le temps où l'utilisateur
            // cherche justement où cliquer. Une fois l'outil en main, la
            // consigne d'étape suffit — et elle ne masque rien.
            hasFigure || tool !== "selection" ? undefined : (
              <EmptyConstruction onChoose={chooseTool} />
            )
          }
        />
      </div>
    </section>
  );
}

/**
 * Accueil d'une construction encore vide.
 *
 * Le fond laisse PASSER les clics (`pointer-events-none`) : seul le panneau
 * les capte. L'utilisateur peut donc commencer sa figure en cliquant n'importe
 * où sur le graphique, exactement comme si l'accueil n'était pas là — ce qui
 * est indispensable, puisque c'est précisément ce que la première ligne lui
 * propose de faire.
 */
function EmptyConstruction({
  onChoose,
}: {
  onChoose: (tool: GeometryToolId) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <div
        className="pointer-events-auto flex max-w-[330px] flex-col items-center gap-3 rounded-[13px] border px-5 py-4 text-center"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: "var(--app-border)",
          boxShadow: "var(--app-shadow-lg)",
        }}
      >
        <p className="app-card-title m-0">Commence une construction</p>
        <p className="m-0 text-[12.5px] leading-snug" style={{ color: "var(--app-text-muted)" }}>
          Choisis un outil, puis clique sur le graphique. Chaque figure devient un
          objet de la construction.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {QUICK_TOOL_IDS.map((id) => {
            const item = TOOLS.find((candidate) => candidate.id === id);
            if (!item) return null;
            return (
              <button
                key={id}
                type="button"
                className="app-chip"
                onClick={() => onChoose(id)}
                title={item.hint}
              >
                <item.Icon size={13} aria-hidden="true" className="mr-1.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Segment, droite ou cercle à partir de deux points EXISTANTS.
 *
 * Un aiguillage explicite plutôt qu'une table de fonctions : le compilateur
 * vérifie ainsi que chaque outil en deux temps a bien ses deux fabriques, et
 * un outil ajouté plus tard ne pourra pas être oublié silencieusement.
 */
function betweenObjects(
  tool: TwoStepToolId,
  construction: MathConstruction,
  firstId: string,
  secondId: string
): MathObject[] {
  switch (tool) {
    case "segment":
      return segmentBetween(construction, firstId, secondId);
    case "droite":
      return lineBetween(construction, firstId, secondId);
    case "cercle":
      return circleBetween(construction, firstId, secondId);
  }
}

/** Même aiguillage, quand le second point est à CRÉER aux coordonnées cliquées. */
function toWorldObjects(
  tool: TwoStepToolId,
  construction: MathConstruction,
  firstId: string,
  world: WorldPoint
): MathObject[] {
  switch (tool) {
    case "segment":
      return segmentToWorld(construction, firstId, world);
    case "droite":
      return lineToWorld(construction, firstId, world);
    case "cercle":
      return circleToWorld(construction, firstId, world);
  }
}
