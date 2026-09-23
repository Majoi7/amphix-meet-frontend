import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useDashboardData } from "../context/DashboardDataContext";
import { MEETING_STATUS_STYLE, type MeetingStatus } from "../lib/derive";
import { formatNumber } from "../lib/format";
import { Card } from "../components/Card";
import { Notice } from "../components/Notice";
import { MeetingsTable } from "../components/MeetingsTable";
import { Pagination } from "../components/Pagination";

const PAGE_SIZE = 10;

const STATUS_OPTIONS: Array<{ value: MeetingStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "Tous les statuts" },
  { value: "IN_PROGRESS", label: MEETING_STATUS_STYLE.IN_PROGRESS.label },
  { value: "SCHEDULED", label: MEETING_STATUS_STYLE.SCHEDULED.label },
  { value: "COMPLETED", label: MEETING_STATUS_STYLE.COMPLETED.label },
  { value: "CANCELLED", label: MEETING_STATUS_STYLE.CANCELLED.label },
];

const ROLE_OPTIONS = [
  { value: "ALL", label: "Tous les rôles" },
  { value: "HOST", label: "Que j'ai ouvertes" },
  { value: "GUEST", label: "Où j'étais invité" },
] as const;

/**
 * Liste des réunions.
 *
 * La recherche est stockée dans l'URL (`?q=`), pas seulement dans l'état du
 * composant : la recherche globale de l'en-tête peut ainsi y renvoyer, et un
 * lien filtré reste partageable et rechargeable tel quel.
 */
export function MeetingsView() {
  const { meetings, loading, error, reload } = useDashboardData();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const [status, setStatus] = useState<MeetingStatus | "ALL">("ALL");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]["value"]>("ALL");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return meetings.filter((meeting) => {
      if (status !== "ALL" && meeting.status !== status) return false;
      if (role === "HOST" && !meeting.isHost) return false;
      if (role === "GUEST" && meeting.isHost) return false;

      if (!needle) return true;
      return (
        meeting.title.toLowerCase().includes(needle) ||
        meeting.joinCode.toLowerCase().includes(needle) ||
        meeting.hostName.toLowerCase().includes(needle)
      );
    });
  }, [meetings, query, status, role]);

  // Tout changement de filtre ramène à la première page : rester en page 4
  // après avoir réduit la liste à 3 lignes afficherait un tableau vide.
  useEffect(() => {
    setPage(1);
  }, [query, status, role]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasActiveFilters = query.trim().length > 0 || status !== "ALL" || role !== "ALL";

  function updateQuery(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("q", next);
    else params.delete("q");
    setSearchParams(params, { replace: true });
  }

  function clearFilters() {
    setStatus("ALL");
    setRole("ALL");
    updateQuery("");
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <Notice tone="warning" title={error}>
          <button
            type="button"
            onClick={reload}
            className="font-semibold underline underline-offset-2"
            style={{ color: "var(--dash-red)" }}
          >
            Recharger
          </button>
        </Notice>
      )}

      {/* ---------- Filtres ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-[280px]">
          <label
            htmlFor="meetings-search"
            className="mb-1 block text-[11.5px] font-medium"
            style={{ color: "var(--dash-text-muted)" }}
          >
            Rechercher
          </label>
          <div className="relative">
            <Search
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--dash-text-subtle)" }}
            />
            <input
              id="meetings-search"
              type="search"
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Titre, code ou hôte…"
              className="dash-input pl-9"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="meetings-status"
            className="mb-1 block text-[11.5px] font-medium"
            style={{ color: "var(--dash-text-muted)" }}
          >
            Statut
          </label>
          <select
            id="meetings-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as MeetingStatus | "ALL")}
            className="dash-select w-full sm:w-[180px]"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="meetings-role"
            className="mb-1 block text-[11.5px] font-medium"
            style={{ color: "var(--dash-text-muted)" }}
          >
            Rôle
          </label>
          <select
            id="meetings-role"
            value={role}
            onChange={(event) => setRole(event.target.value as typeof role)}
            className="dash-select w-full sm:w-[180px]"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} className="dash-btn dash-btn-ghost">
            <X size={14} aria-hidden="true" />
            Réinitialiser
          </button>
        )}
      </div>

      {/* ---------- Tableau ---------- */}
      <Card
        title="Réunions"
        description={
          loading
            ? "Chargement…"
            : `${formatNumber(filtered.length)} réunion${filtered.length > 1 ? "s" : ""}${
                hasActiveFilters ? " correspondante" + (filtered.length > 1 ? "s" : "") : ""
              }`
        }
      >
        {loading ? (
          <div className="px-4 py-4">
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className="dash-skeleton my-2 h-10 w-full" />
            ))}
          </div>
        ) : (
          <MeetingsTable
            meetings={rows}
            emptyTitle={hasActiveFilters ? "Aucune réunion ne correspond" : "Aucune réunion"}
            emptyDescription={
              hasActiveFilters
                ? "Élargis la recherche ou réinitialise les filtres."
                : "Vos réunions apparaîtront ici dès que vous en aurez lancé une."
            }
          />
        )}

        {!loading && (
          <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
        )}
      </Card>

      <Notice title="Deux limites à connaître">
        L'API ne renvoie que vos réunions — celles que vous avez ouvertes ou auxquelles vous
        avez participé — et plafonne la liste aux 20 plus récentes. Le nombre de participants
        par réunion n'est pas exposé.
      </Notice>
    </div>
  );
}
