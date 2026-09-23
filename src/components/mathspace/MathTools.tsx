import { useEffect, useRef } from "react";
import {
  Calculator,
  Check,
  CircleSlash,
  Equal,
  LineChart,
  Shapes,
  type LucideIcon,
} from "lucide-react";
import { revealHorizontally } from "./revealInScroll";

/**
 * Sélection de l'outil, et INVENTAIRE HONNÊTE de ce que le moteur sait faire.
 *
 * L'onglet « Limites » n'est pas un aveu de faiblesse : c'est la seule façon
 * de tenir la règle « ne prétends jamais supporter une opération que le
 * moteur ne supporte pas ». Un utilisateur qui lit cette page sait
 * exactement à quoi s'en tenir, et ne perd pas son temps à chercher une
 * fonction qui n'existe pas.
 *
 * Cette page doit donc être TENUE À JOUR : une entrée qui décrit comme
 * impossible ce qui fonctionne désormais est un mensonge, pas une prudence.
 * L'ajout de la géométrie en C3 a rendu fausse l'ancienne entrée
 * « Géométrie » ; elle a été réécrite pour dire ce qui manque encore.
 */

export type MathToolId =
  | "calculatrice"
  | "fonctions"
  | "geometrie"
  | "equations"
  | "limites";

interface ToolDef {
  id: MathToolId;
  label: string;
  Icon: LucideIcon;
}

const TOOLS: ToolDef[] = [
  { id: "calculatrice", label: "Calculatrice", Icon: Calculator },
  { id: "fonctions", label: "Fonctions", Icon: LineChart },
  { id: "geometrie", label: "Géométrie", Icon: Shapes },
  { id: "equations", label: "Équations", Icon: Equal },
  { id: "limites", label: "Limites", Icon: CircleSlash },
];

export const TOOL_PANEL_ID = "mathspace-tool-panel";

export function MathToolTabs({
  active,
  onChange,
}: {
  active: MathToolId;
  onChange: (next: MathToolId) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndex = TOOLS.findIndex((tool) => tool.id === active);

  /**
   * Garde l'onglet actif dans le champ visible.
   *
   * Cinq onglets libellés ne tiennent pas dans 360 px : la liste défile. Or
   * l'outil actif ne change pas seulement au doigt — reprendre une ligne de
   * l'historique le change par programme. Sans ce repositionnement, l'onglet
   * activé pourrait l'être hors de l'écran, et la barre afficherait autre
   * chose que ce que l'espace est en train de faire.
   */
  useEffect(() => {
    revealHorizontally(
      containerRef.current,
      containerRef.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? null
    );
  }, [active]);

  function moveFocus(nextIndex: number) {
    const buttons =
      containerRef.current?.querySelectorAll<HTMLButtonElement>("[role='tab']");
    buttons?.[nextIndex]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const handled = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!handled.includes(event.key)) return;
    event.preventDefault();

    let nextIndex = activeIndex;
    if (event.key === "ArrowRight") nextIndex = (activeIndex + 1) % TOOLS.length;
    else if (event.key === "ArrowLeft")
      nextIndex = (activeIndex - 1 + TOOLS.length) % TOOLS.length;
    else if (event.key === "Home") nextIndex = 0;
    else nextIndex = TOOLS.length - 1;

    if (nextIndex === activeIndex) return;
    onChange(TOOLS[nextIndex].id);
    moveFocus(nextIndex);
  }

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label="Outils mathématiques"
      onKeyDown={handleKeyDown}
      className="app-tablist"
    >
      {TOOLS.map((tool) => {
        const isActive = tool.id === active;
        return (
          <button
            key={tool.id}
            type="button"
            role="tab"
            id={`mathspace-tab-${tool.id}`}
            aria-selected={isActive}
            aria-controls={TOOL_PANEL_ID}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tool.id)}
            className="app-tab"
          >
            <tool.Icon size={15} aria-hidden="true" />
            {tool.label}
          </button>
        );
      })}
    </div>
  );
}

/** Ce que le moteur fait réellement — vérifié dans le code, pas supposé. */
const SUPPORTED: string[] = [
  "Les quatre opérations : + − × ÷, avec la multiplication implicite (2x, 3(x+1)).",
  "Les parenthèses, imbriquées autant que nécessaire.",
  "Les puissances (2^10, 2^-1) et la factorielle (5!).",
  "Les racines : sqrt(2), cbrt(27).",
  "Les fonctions trigonométriques et leurs réciproques : sin, cos, tan, asin, acos, atan.",
  "Les fonctions hyperboliques : sinh, cosh, tanh.",
  "Les logarithmes et exponentielles : ln, log (base 10), log2, exp.",
  "Arrondis et signe : abs, floor, ceil, round, trunc, sign.",
  "Les constantes π, e et tau.",
  "La forme exacte des rationnels et des racines de carrés parfaits.",
  "La résolution des équations du premier et du second degré à coefficients rationnels.",
  "Le tracé interactif des fonctions de x, avec zoom et déplacement.",
  "Les objets géométriques : point, segment, droite, cercle, construits au clic sur le graphique.",
  "Les intersections entre droites, segments et cercles, chaque solution étant un objet à part entière.",
  "La suppression en cascade : supprimer un point emporte les objets qui s'y appuient.",
];

/** Ce que le moteur ne fait PAS, avec la raison — jamais masqué. */
const UNSUPPORTED: { title: string; reason: string }[] = [
  {
    title: "Algèbre symbolique",
    reason:
      "Développer, factoriser ou simplifier une expression littérale. Le moteur évalue une expression pour une valeur donnée ; il ne la transforme pas en une autre expression.",
  },
  {
    title: "Dérivées et intégrales",
    reason:
      "Aucun calcul formel n'est implémenté. Le tracé montre la courbe, pas sa dérivée.",
  },
  {
    title: "Équations au-delà du second degré",
    reason:
      "Le solveur s'arrête au degré 2, et refuse l'inconnue sous une fonction (sin(x) = 0,5), au dénominateur (1/x = 2) ou dans un coefficient irrationnel (π·x = 1). Chacun de ces cas est annoncé comme non pris en charge.",
  },
  {
    title: "Statistiques",
    reason:
      "Moyenne, médiane, écart-type : aucune saisie de série de données n'existe, et ces calculs ne font pas partie du moteur d'expressions.",
  },
  {
    title: "Géométrie : mesures et transformations",
    reason:
      "Les figures se construisent et se coupent, mais rien ne les MESURE : ni longueur, ni aire, ni angle, ni périmètre. Aucune transformation non plus — translation, rotation, symétrie, homothétie. Et les points sont posés au clic : ils ne se déplacent pas encore une fois créés.",
  },
  {
    title: "Intersections avec une courbe",
    reason:
      "Couper une courbe de fonction demande une recherche de racines numériques, avec ses questions de convergence et de multiplicité. Seules les droites, segments et cercles se coupent entre eux.",
  },
  {
    title: "Tangentes, polygones, lieux",
    reason:
      "Non implémentés. Le moteur géométrique couvre le point, le segment, la droite, le cercle et l'intersection — pas au-delà.",
  },
  {
    title: "Matrices, vecteurs, nombres complexes",
    reason: "Non implémentés.",
  },
  {
    title: "Unités et conversions",
    reason:
      "Le moteur ne connaît que des nombres nus. Aucune unité n'est affichée à côté d'un résultat : en inventer une laisserait croire à une conversion qui n'a pas eu lieu.",
  },
  {
    title: "Fonctions nommées mais refusées",
    reason:
      "cot, sec, csc, min, max, gcd, lcm, mod sont reconnues : le moteur les refuse explicitement (« Fonction non prise en charge ») au lieu de laisser croire à une faute de frappe.",
  },
];

export function MathLimits() {
  return (
    <div className="flex flex-col gap-4">
      <section className="app-card" aria-labelledby="math-supported-title">
        <header className="app-card-head">
          <div className="min-w-0">
            <h2 id="math-supported-title" className="app-card-title">
              Ce que le moteur fait réellement
            </h2>
            <p className="app-card-desc">
              Tout ce qui suit est vérifié dans le code du moteur, pas supposé.
            </p>
          </div>
          <span className="app-badge app-badge-blue shrink-0">
            <Check size={12} aria-hidden="true" />
            Vérifié
          </span>
        </header>
        <ul className="app-card-body flex flex-col gap-2">
          {SUPPORTED.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[13px]">
              <Check
                size={14}
                aria-hidden="true"
                className="mt-0.5 shrink-0"
                style={{ color: "var(--app-green)" }}
              />
              <span style={{ color: "var(--app-text-muted)" }}>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="app-card" aria-labelledby="math-unsupported-title">
        <header className="app-card-head">
          <div className="min-w-0">
            <h2 id="math-unsupported-title" className="app-card-title">
              Ce que le moteur ne fait pas
            </h2>
            <p className="app-card-desc">
              Ces outils ne sont pas proposés parce que le moteur ne sait pas les
              calculer. Les afficher sans les implémenter donnerait une réponse fausse.
            </p>
          </div>
          <span className="app-badge app-badge-slate shrink-0">
            <CircleSlash size={12} aria-hidden="true" />
            Non disponible
          </span>
        </header>
        <ul className="app-card-body flex flex-col gap-3">
          {UNSUPPORTED.map((item) => (
            <li key={item.title} className="flex items-start gap-2.5">
              <CircleSlash
                size={14}
                aria-hidden="true"
                className="mt-0.5 shrink-0"
                style={{ color: "var(--app-text-subtle)" }}
              />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: "var(--app-text)" }}>
                  {item.title}
                </p>
                <p
                  className="mt-0.5 text-[12.5px] leading-snug"
                  style={{ color: "var(--app-text-muted)" }}
                >
                  {item.reason}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
