import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useDashboardTheme } from "./context/DashboardThemeContext";
import { DashboardDataProvider, useDashboardData } from "./context/DashboardDataContext";
import { Sidebar } from "./components/Sidebar";
import { AdminHeader } from "./components/Header";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { buildPeople } from "./lib/derive";
import { DESKTOP_QUERY, useMediaQuery } from "./lib/useMediaQuery";
import { useDismissable } from "./lib/useDismissable";
import { useFocusTrap } from "./lib/useFocusTrap";
// L'ordre compte : `theme.css` déclare les jetons (et leurs alias `--dash-*`),
// `dashboard.css` s'en sert. L'inverse laisserait une première peinture sans
// couleurs définies.
import "../../styles/theme.css";
import "./dashboard.css";

/**
 * Coquille de l'espace d'administration Amphix.
 *
 * Elle n'a AUCUN lien avec la salle de réunion : elle porte sa propre source
 * de données (`DashboardDataProvider`) et sa propre feuille de style
 * (`dashboard.css`, limitée aux classes `dash-*`). Aucun composant de la
 * réunion n'est importé ici, et rien de ce qui est défini ici ne s'applique
 * à la réunion.
 *
 * Le THÈME, lui, n'est plus monté ici : il est partagé avec l'espace
 * mathématique et fourni une seule fois, au-dessus du routeur (`App.tsx`).
 * Deux fournisseurs séparés auraient donné deux préférences distinctes,
 * incapables de se synchroniser.
 *
 * Le fournisseur de données est monté ICI, et pas plus haut : les données de
 * l'administration ne sont chargées qu'en entrant dans l'administration,
 * jamais pendant une réunion.
 */
export function AdminLayout() {
  return (
    <DashboardDataProvider>
      <DashboardShell />
    </DashboardDataProvider>
  );
}

function DashboardShell() {
  const { resolved } = useDashboardTheme();
  const { meetings, bookings } = useDashboardData();
  const { user } = useAuth();
  const location = useLocation();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Le tiroir se referme dès qu'on change de page, et dès qu'on repasse en
  // grand écran : le laisser ouvert derrière la colonne fixe donnerait deux
  // navigations superposées.
  useEffect(() => {
    closeDrawer();
  }, [location.pathname, closeDrawer]);

  useEffect(() => {
    if (isDesktop) closeDrawer();
  }, [isDesktop, closeDrawer]);

  const dismissRef = useDismissable<HTMLDivElement>(isDrawerOpen, closeDrawer);
  const trapRef = useFocusTrap<HTMLDivElement>(isDrawerOpen);

  // Compteurs de la navigation — tous issus des données réellement chargées.
  const counts = useMemo<Partial<Record<string, number>>>(() => {
    const result: Partial<Record<string, number>> = {
      "/dashboard/meetings": meetings.length,
      "/dashboard/history": meetings.filter(
        (meeting) => meeting.status === "COMPLETED" || meeting.status === "CANCELLED"
      ).length,
    };
    const peopleCount = buildPeople(user, bookings).length;
    // Un « 1 » serait toujours votre propre compte : il n'apprend rien.
    if (peopleCount > 1) result["/dashboard/users"] = peopleCount;
    return result;
  }, [meetings, bookings, user]);

  const sidebarFooter = (
    <div className="lg:hidden">
      <p className="dash-nav-group-label px-1 pb-2">Apparence</p>
      <ThemeSwitcher />
    </div>
  );

  return (
    <div data-theme={resolved} className="dash-root flex h-screen overflow-hidden">
      {/* Colonne fixe — grand écran uniquement */}
      <div className="hidden lg:flex">
        <Sidebar counts={counts} footer={sidebarFooter} />
      </div>

      {/* Tiroir — sous lg */}
      {isDrawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <div
            ref={(node) => {
              dismissRef.current = node;
              trapRef.current = node;
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation de l'administration"
            className="fixed inset-y-0 left-0 z-50 lg:hidden"
            style={{ boxShadow: "var(--dash-shadow-lg)" }}
          >
            <div className="relative h-full">
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Fermer la navigation"
                className="dash-icon-btn absolute right-2 top-3 z-10"
                style={{ backgroundColor: "var(--dash-surface-2)" }}
              >
                <X size={18} aria-hidden="true" />
              </button>
              <Sidebar counts={counts} onNavigate={closeDrawer} footer={sidebarFooter} />
            </div>
          </div>
        </>
      )}

      {/* Colonne principale */}
      <div className="flex min-w-0 flex-1 flex-col" aria-hidden={isDrawerOpen || undefined}>
        <AdminHeader onOpenSidebar={() => setDrawerOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1240px] px-4 py-5 sm:px-6 sm:py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
