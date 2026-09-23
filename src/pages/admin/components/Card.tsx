import type { ReactNode } from "react";

/**
 * Carte de section.
 *
 * Un seul composant pour toutes les cartes de contenu : bordure fine,
 * arrondi, ombre discrète — la même recette partout. Le titre est un vrai
 * `<h2>` pour que la page reste navigable au lecteur d'écran.
 */
export function Card({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="dash-card overflow-hidden">
      <header
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid var(--dash-border)" }}
      >
        <div className="min-w-0">
          <h2 className="text-[13.5px] font-semibold" style={{ color: "var(--dash-text)" }}>
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: "var(--dash-text-subtle)" }}>
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div>{children}</div>
    </section>
  );
}
