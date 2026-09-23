import type { ReactNode } from "react";

/**
 * État vide — une seule mise en forme pour tous les « rien à afficher ».
 *
 * Le texte doit dire POURQUOI c'est vide. « Aucune donnée » sans explication
 * se confond avec une panne ; « Aucune donnée : l'API n'expose pas cette
 * information » est une réponse.
 */
export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {icon && (
        <div
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--dash-surface-2)", color: "var(--dash-text-subtle)" }}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <p className="text-sm font-medium" style={{ color: "var(--dash-text)" }}>
        {title}
      </p>
      {description && (
        <p
          className="mt-1 max-w-md text-[12.5px] leading-relaxed"
          style={{ color: "var(--dash-text-muted)" }}
        >
          {description}
        </p>
      )}
    </div>
  );
}
