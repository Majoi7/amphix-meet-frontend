import { useMemo } from "react";
import { Eye, EyeOff, Layers, Trash2, TriangleAlert } from "lucide-react";
import {
  DEFAULT_OBJECT_COLOR,
  MATH_OBJECT_KIND_LABELS,
  RENDERED_KINDS,
  type MathConstruction,
  type MathObject,
} from "../../lib/math/construction";
import { describeObject } from "../../lib/math/geometry";
import { OBJECT_ICONS } from "./mathObjectIcons";

/**
 * Liste des objets de la construction.
 *
 * C'est une VUE, pas un état : elle ne reçoit que la construction et des
 * rappels. Elle ne garde aucun objet de son côté — deux sources de vérité pour
 * la même liste divergeraient au premier oubli, et c'est exactement ce que
 * cette refonte cherche à supprimer.
 *
 * Elle affiche aussi ce que le renderer NE SAIT PAS tracer, et POURQUOI. Trois
 * états sont distingués, parce qu'ils appellent trois réactions différentes :
 *
 *  - « non tracé » : le genre existe dans le modèle mais le renderer ne le
 *    dessine pas encore — une étape non écrite, pas une panne ;
 *  - « bloqué » : une dépendance manque, ou forme un cycle. La cause est
 *    racine, et le résolveur la connaît ;
 *  - « invalide » : l'objet est complet mais sa géométrie ne tient pas —
 *    deux points confondus, une définition illisible, une intersection qui
 *    n'existe plus. La raison est calculée par `geometry.ts`.
 *
 * La suppression est ici, la création non : un objet naît de l'outil qui sait
 * le définir — l'onglet Fonctions pour une courbe, l'onglet Géométrie pour une
 * figure. La liste CONSTATE, elle ne fabrique pas.
 */
export function MathObjectList({
  construction,
  blocked,
  invalid,
  onSelect,
  onRemove,
  onToggleVisibility,
}: {
  construction: MathConstruction;
  /** Objets non rendables — dépendance manquante ou cycle (voir le résolveur). */
  blocked: ReadonlySet<string>;
  /** Objets géométriquement inexploitables, et la raison, en français. */
  invalid: ReadonlyMap<string, string>;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
}) {
  const { objects, selection } = construction;

  // Table de correspondance pour `describeObject` : les objets dérivés sont
  // décrits par les NOMS de leurs dépendances, qu'il faut donc pouvoir
  // retrouver par identifiant.
  const byId = useMemo(() => {
    const map = new Map<string, MathObject>();
    for (const object of objects) map.set(object.id, object);
    return map;
  }, [objects]);

  return (
    <section className="app-card flex min-h-0 flex-col" aria-labelledby="math-objects-title">
      <header className="app-card-head">
        <div className="min-w-0">
          <h2 id="math-objects-title" className="app-card-title">
            <span className="inline-flex items-center gap-2">
              <Layers size={15} aria-hidden="true" />
              Objets
            </span>
          </h2>
          <p className="app-card-desc">
            {objects.length === 0
              ? "Les objets de la construction apparaîtront ici."
              : `${objects.length} objet${objects.length > 1 ? "s" : ""} dans la construction.`}
          </p>
        </div>
      </header>

      {/* Aucun plafond de hauteur, ni ici ni sur petit écran.
          Il y en avait un, du temps où cette liste précédait le graphe : sans
          lui, une longue construction repoussait le graphe hors de l'écran.
          Ce n'est plus le cas — le graphe vient désormais en premier — et le
          plafond ne servait plus qu'à empiler deux zones de défilement, l'une
          dans l'autre, ce qui se manipule mal au doigt. Le défilement est donc
          celui de la page sur petit écran, et celui de la colonne latérale sur
          grand écran ; jamais celui de la liste. */}
      <div className="min-h-0 flex-1 p-2">
        {objects.length === 0 ? (
          <p
            className="px-3 py-6 text-center text-[12.5px]"
            style={{ color: "var(--app-text-subtle)" }}
          >
            Aucun objet. Ajoute une courbe depuis l&apos;onglet Fonctions, ou une
            figure depuis l&apos;onglet Géométrie.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {objects.map((object) => (
              <ObjectRow
                key={object.id}
                object={object}
                description={describeObject(object, byId)}
                selected={selection.selectedObjectId === object.id}
                blocked={blocked.has(object.id)}
                invalidReason={invalid.get(object.id) ?? null}
                onSelect={onSelect}
                onRemove={onRemove}
                onToggleVisibility={onToggleVisibility}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ObjectRow({
  object,
  description,
  selected,
  blocked,
  invalidReason,
  onSelect,
  onRemove,
  onToggleVisibility,
}: {
  object: MathObject;
  /** Phrase lisible, calculée depuis les dépendances — jamais stockée. */
  description: string;
  selected: boolean;
  blocked: boolean;
  invalidReason: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
}) {
  const kindLabel = MATH_OBJECT_KIND_LABELS[object.kind];
  const name = object.label ?? object.id;
  const rendered = RENDERED_KINDS.has(object.kind);

  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        className="app-history-item min-w-0 flex-1"
        onClick={() => onSelect(object.id)}
        aria-pressed={selected}
        aria-label={`Sélectionner ${name} — ${kindLabel}`}
        title="Sélectionner cet objet"
        style={{
          borderColor: selected ? "var(--app-accent)" : undefined,
          backgroundColor: selected ? "var(--app-surface-2)" : undefined,
        }}
      >
        <span className="flex items-center gap-2">
          {/* Le glyphe du genre, teinté de la couleur de l'objet : il dit à la
              fois CE QUE c'est et DE QUELLE COULEUR, là où une pastille ronde
              ne disait que la couleur et laissait le genre à une étiquette.
              Un point reste rond, un segment reste un trait — la forme se
              reconnaît avant d'être lue. */}
          <KindIcon
            kind={object.kind}
            color={object.style.color ?? DEFAULT_OBJECT_COLOR}
            faded={!object.visible}
          />
          {/* `shrink-0` a été retiré : il annulait le `min-w-0` du parent, et
              un nom long — « intersection_d_cercle_1 » — poussait les pastilles
              puis les deux boutons d'action hors de la ligne, créant un
              débordement horizontal dans la colonne. Le nom est ce qui doit
              céder : il se tronque, et l'infobulle du bouton porte le nom
              entier. Les pastilles, elles, restent insécables — « invalide »
              coupé en deux ne se lit pas. */}
          <span
            className="app-mono min-w-0 truncate text-[13px] font-semibold"
            style={{ color: "var(--app-text)" }}
            title={name}
          >
            {name}
          </span>
          <span className="app-badge app-badge-slate shrink-0">{kindLabel}</span>
          {!rendered && (
            <span
              className="app-badge app-badge-amber shrink-0"
              title="Décrit par le modèle, mais ce genre n'est pas encore tracé par le renderer."
            >
              non tracé
            </span>
          )}
          {blocked ? (
            <span
              className="app-badge app-badge-amber shrink-0"
              title={invalidReason ?? "Dépendance manquante ou cycle : cet objet ne peut pas être rendu."}
            >
              <TriangleAlert size={11} aria-hidden="true" />
              bloqué
            </span>
          ) : (
            invalidReason !== null && (
              <span className="app-badge app-badge-amber shrink-0" title={invalidReason}>
                <TriangleAlert size={11} aria-hidden="true" />
                invalide
              </span>
            )
          )}
        </span>
        <span
          className="app-mono app-history-result block truncate"
          style={{ opacity: object.visible ? 1 : 0.5 }}
          // La raison complète est longue : elle tient dans l'infobulle, et le
          // panneau de propriétés la répète en clair.
          title={invalidReason ?? description}
        >
          {invalidReason ?? description}
        </span>
      </button>

      <button
        type="button"
        className="app-icon-btn shrink-0"
        onClick={() => onToggleVisibility(object.id, !object.visible)}
        aria-label={object.visible ? `Masquer ${name}` : `Afficher ${name}`}
        aria-pressed={!object.visible}
        title={object.visible ? "Masquer" : "Afficher"}
      >
        {object.visible ? (
          <Eye size={14} aria-hidden="true" />
        ) : (
          <EyeOff size={14} aria-hidden="true" />
        )}
      </button>

      <button
        type="button"
        className="app-icon-btn shrink-0"
        onClick={() => onRemove(object.id)}
        aria-label={`Supprimer ${name}`}
        title="Supprimer"
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </li>
  );
}

/** Le glyphe d'un genre, teinté de la couleur de son objet. */
function KindIcon({
  kind,
  color,
  faded,
}: {
  kind: MathObject["kind"];
  color: string;
  /** Un objet masqué reste listé, mais son glyphe dit qu'il ne participe plus
   *  au tracé. */
  faded: boolean;
}) {
  const Icon = OBJECT_ICONS[kind];
  return (
    <Icon
      size={14}
      aria-hidden="true"
      className="shrink-0"
      style={{ color, opacity: faded ? 0.35 : 1 }}
    />
  );
}
