import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { NAV_GROUPS } from "../lib/navigation";

interface SidebarProps {
  /**
   * Compteurs affichés à droite de certaines entrées. Ce sont des nombres
   * RÉELS, calculés à partir des données chargées — jamais des décors. Une
   * entrée sans donnée disponible n'affiche simplement pas de compteur.
   */
  counts: Partial<Record<string, number>>;
  /** Appelé après un clic sur un lien : ferme le tiroir sur mobile. */
  onNavigate?: () => void;
  /**
   * Contenu inséré au-dessus du pied. Sur mobile, `AdminLayout` y place le
   * sélecteur de thème : la barre latérale est alors le seul endroit où il
   * tient sans comprimer l'en-tête.
   */
  footer?: ReactNode;
}

/**
 * Navigation latérale de l'espace d'administration.
 *
 * Un seul composant sert les deux présentations : colonne fixe sur grand
 * écran, tiroir sur mobile (voir `AdminLayout`). Deux composants séparés
 * auraient fini par diverger dans leurs libellés.
 */
export function Sidebar({ counts, onNavigate, footer }: SidebarProps) {
  return (
    <div className="dash-panel flex h-full w-[248px] shrink-0 flex-col">
      {/* Marque */}
      <div
        className="flex h-14 shrink-0 items-center gap-2.5 px-4"
        style={{ borderBottom: "1px solid var(--dash-border)" }}
      >
        <img src="/favicon.svg" alt="" className="h-7 w-7 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold leading-tight" style={{ color: "var(--dash-text)" }}>
            Amphix Meet
          </p>
          <p className="truncate text-[11px] leading-tight" style={{ color: "var(--dash-text-subtle)" }}>
            Administration
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Navigation de l'administration" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <p className="dash-nav-group-label px-2.5 pb-2">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const count = counts[item.to];
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      className="dash-nav-item"
                      title={item.description}
                    >
                      <item.Icon size={16} className="dash-nav-icon shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                      {count !== undefined && count > 0 && (
                        <span className="dash-nav-count">{count}</span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Pied */}
      <div className="shrink-0 p-3" style={{ borderTop: "1px solid var(--dash-border)" }}>
        {footer && <div className="mb-3">{footer}</div>}
        <NavLink to="/" className="dash-nav-item" onClick={onNavigate}>
          <ArrowLeft size={16} className="dash-nav-icon shrink-0" aria-hidden="true" />
          <span className="truncate">Retour à l'espace</span>
        </NavLink>
      </div>
    </div>
  );
}
