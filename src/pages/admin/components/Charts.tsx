import type { StatusStyle } from "../lib/derive";

type Tone = StatusStyle["tone"];

/** Une teinte d'état = une variable CSS. Aucune couleur codée en dur. */
export const TONE_COLOR: Record<Tone, string> = {
  green: "var(--dash-green)",
  blue: "var(--dash-blue)",
  slate: "var(--dash-slate)",
  red: "var(--dash-red)",
  amber: "var(--dash-accent)",
};

/* ══════════════════════════════════════════════════════════════════════
   Barres horizontales — pour une répartition
   ══════════════════════════════════════════════════════════════════════ */

export interface BarListItem {
  id: string;
  label: string;
  value: number;
  tone: Tone;
}

export function BarList({ items, unitLabel }: { items: BarListItem[]; unitLabel: string }) {
  // Le maximum sert d'échelle. S'il est nul, la liste serait vide de toute
  // façon : `Math.max(..., 1)` évite seulement une division par zéro.
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <ul className="px-4 py-2">
      {items.map((item) => {
        const percent = Math.round((item.value / max) * 100);
        return (
          <li key={item.id} className="py-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[12.5px]" style={{ color: "var(--dash-text)" }}>
                {item.label}
              </span>
              <span
                className="shrink-0 text-[12.5px] font-semibold tabular-nums"
                style={{ color: "var(--dash-text)" }}
              >
                {item.value}
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: "var(--dash-surface-3)" }}
              role="img"
              aria-label={`${item.label} : ${item.value} ${unitLabel}`}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${percent}%`, backgroundColor: TONE_COLOR[item.tone] }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Colonnes — pour une série ordonnée dans le temps
   ══════════════════════════════════════════════════════════════════════ */

export interface ColumnDatum {
  id: string;
  /** Étiquette courte sous la colonne (heure, date abrégée). */
  label: string;
  value: number;
  /** Valeur écrite au-dessus de la colonne — c'est aussi le texte lu par
   *  les lecteurs d'écran, d'où l'absence de tableau caché séparé. */
  valueLabel: string;
  /** Infobulle : le détail complet. */
  caption: string;
}

export function ColumnChart({
  data,
  ariaLabel,
  height = 168,
}: {
  data: ColumnDatum[];
  ariaLabel: string;
  height?: number;
}) {
  const max = Math.max(...data.map((datum) => datum.value), 1);

  return (
    <div className="px-4 py-4">
      <div className="flex gap-2" style={{ height }} role="img" aria-label={ariaLabel}>
        {data.map((datum) => {
          // 80 % au maximum : la place restante est réservée à l'étiquette de
          // valeur, qui ne peut donc jamais être rognée par la colonne.
          const percent = Math.max(3, Math.round((datum.value / max) * 80));
          return (
            <div key={datum.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <span
                className="mb-1 shrink-0 text-[10.5px] font-medium tabular-nums"
                style={{ color: "var(--dash-text-muted)" }}
              >
                {datum.valueLabel}
              </span>
              <div
                className="w-full max-w-[54px] rounded-t-[5px]"
                style={{ height: `${percent}%`, backgroundColor: "var(--dash-accent)" }}
                title={datum.caption}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2" aria-hidden="true">
        {data.map((datum) => (
          <span
            key={datum.id}
            className="min-w-0 flex-1 truncate text-center text-[10.5px]"
            style={{ color: "var(--dash-text-subtle)" }}
          >
            {datum.label}
          </span>
        ))}
      </div>
    </div>
  );
}
