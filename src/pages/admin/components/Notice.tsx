import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";

/**
 * Encadré d'information.
 *
 * Il sert à DIRE CE QUI MANQUE, au lieu de laisser un vide ambigu. Une
 * colonne vide ou un « — » sans explication se confond avec une panne ;
 * l'encadré transforme l'absence en réponse.
 */
export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning";
  title: string;
  children?: ReactNode;
}) {
  const isWarning = tone === "warning";
  const Icon = isWarning ? AlertTriangle : Info;

  return (
    <div
      className="flex gap-3 rounded-[10px] px-3.5 py-3"
      style={{
        backgroundColor: isWarning ? "var(--dash-red-soft)" : "var(--dash-surface-2)",
        border: `1px solid ${isWarning ? "transparent" : "var(--dash-border)"}`,
      }}
    >
      <Icon
        size={15}
        aria-hidden="true"
        className="mt-0.5 shrink-0"
        style={{ color: isWarning ? "var(--dash-red)" : "var(--dash-text-subtle)" }}
      />
      <div className="min-w-0">
        <p
          className="text-[12.5px] font-semibold"
          style={{ color: isWarning ? "var(--dash-red)" : "var(--dash-text)" }}
        >
          {title}
        </p>
        {children && (
          <div
            className="mt-1 text-[12px] leading-relaxed"
            style={{ color: "var(--dash-text-muted)" }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
