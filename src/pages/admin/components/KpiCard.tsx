import type { ReactNode } from "react";

/**
 * Carte d'indicateur.
 *
 * `unavailable` est un état de PREMIER PLAN, pas un cas dégradé : quand la
 * donnée n'existe pas côté serveur, la carte affiche « N/A » et explique
 * pourquoi. Elle n'affiche jamais 0 à la place — un zéro se lirait comme
 * une mesure (« il n'y a eu aucune réunion »), ce qui serait faux.
 */
export function KpiCard({
  icon,
  label,
  value,
  hint,
  unavailable = false,
  loading = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  unavailable?: boolean;
  loading?: boolean;
}) {
  return (
    <article className="dash-card p-4">
      <header className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: unavailable ? "var(--dash-surface-2)" : "var(--dash-accent-soft)",
            color: unavailable ? "var(--dash-text-subtle)" : "var(--dash-accent-strong)",
          }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <h3
          className="min-w-0 truncate text-[12.5px] font-medium"
          style={{ color: "var(--dash-text-muted)" }}
        >
          {label}
        </h3>
      </header>

      {loading ? (
        <div className="dash-skeleton mt-3 h-8 w-20" aria-hidden="true" />
      ) : (
        <p
          className="mt-3 text-2xl font-semibold leading-none tabular-nums"
          style={{ color: unavailable ? "var(--dash-text-subtle)" : "var(--dash-text)" }}
        >
          {value}
        </p>
      )}

      {hint && (
        <p
          className="mt-2 text-[11.5px] leading-snug"
          style={{ color: "var(--dash-text-subtle)" }}
        >
          {hint}
        </p>
      )}
    </article>
  );
}
