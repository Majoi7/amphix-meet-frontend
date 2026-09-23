import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Search, X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { getAvatarColor } from "../../../lib/avatarColor";
import { findNavItem } from "../lib/navigation";
import { initialsOf } from "../lib/format";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationsMenu } from "./NotificationsMenu";
import { ThemeSwitcher } from "./ThemeSwitcher";

/**
 * En-tête de l'administration.
 *
 * Volontairement bas (56 px) : il porte le titre de la page, la recherche,
 * les notifications, le thème et le compte. Les actions de création, elles,
 * appartiennent aux pages — un en-tête qui accumule les boutons devient un
 * second menu.
 */
export function AdminHeader({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const current = findNavItem(location.pathname);

  return (
    <header
      className="shrink-0"
      style={{
        backgroundColor: "var(--dash-surface)",
        borderBottom: "1px solid var(--dash-border)",
      }}
    >
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
        {/* Tiroir, sur mobile uniquement */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Ouvrir la navigation"
          className="dash-icon-btn lg:hidden"
        >
          <Menu size={18} aria-hidden="true" />
        </button>

        {/* Titre de la page */}
        <div className="min-w-0 flex-1">
          <h1
            className="truncate text-[15px] font-semibold leading-tight"
            style={{ color: "var(--dash-text)" }}
          >
            {current?.label ?? "Administration"}
          </h1>
          {current && (
            <p
              className="hidden truncate text-[11.5px] leading-tight sm:block"
              style={{ color: "var(--dash-text-subtle)" }}
            >
              {current.description}
            </p>
          )}
        </div>

        {/* Recherche — champ fixe à partir de lg, sinon bouton dépliant */}
        <div className="hidden w-[260px] shrink-0 lg:block">
          <GlobalSearch />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setMobileSearchOpen((open) => !open)}
            aria-label={mobileSearchOpen ? "Fermer la recherche" : "Ouvrir la recherche"}
            aria-expanded={mobileSearchOpen}
            className="dash-icon-btn lg:hidden"
          >
            {mobileSearchOpen ? <X size={18} aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
          </button>

          <NotificationsMenu />

          <div className="hidden sm:block">
            <ThemeSwitcher compact />
          </div>

          {user && (
            <Link
              to="/profile"
              aria-label={`Compte de ${user.name}`}
              title={user.name}
              className="ml-1 flex h-8 items-center gap-2 rounded-full pl-0.5 pr-1 transition-colors hover:bg-[var(--dash-surface-2)]"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-black"
                  style={{ backgroundColor: getAvatarColor(user.id) }}
                  aria-hidden="true"
                >
                  {initialsOf(user.name)}
                </span>
              )}
              <span
                className="hidden max-w-[120px] truncate text-[12.5px] font-medium xl:block"
                style={{ color: "var(--dash-text)" }}
              >
                {user.name}
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Recherche dépliée — un second rang, uniquement sous lg */}
      {mobileSearchOpen && (
        <div className="px-3 pb-3 lg:hidden">
          <GlobalSearch autoFocus />
        </div>
      )}
    </header>
  );
}
