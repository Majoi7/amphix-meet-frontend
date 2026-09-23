import type { StatusStyle } from "../lib/derive";

/** Étiquette d'état. La teinte vient de `derive.ts` : un statut = une
 *  couleur, partout dans l'administration. */
export function StatusBadge({
  tone,
  label,
  withDot = true,
}: {
  tone: StatusStyle["tone"];
  label: string;
  withDot?: boolean;
}) {
  return (
    <span className={`dash-badge dash-badge-${tone}`}>
      {withDot && <span className="dash-dot" aria-hidden="true" />}
      {label}
    </span>
  );
}
