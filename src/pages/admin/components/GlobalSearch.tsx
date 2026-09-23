import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Video, Users as UsersIcon } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useDashboardData } from "../context/DashboardDataContext";
import { buildPeople, MEETING_STATUS_STYLE } from "../lib/derive";
import { useDismissable } from "../lib/useDismissable";

const MAX_MEETINGS = 5;
const MAX_PEOPLE = 4;

/**
 * Recherche globale de l'administration.
 *
 * Elle porte sur les données RÉELLEMENT chargées — vos réunions et les
 * personnes de vos séances — et non sur un index serveur qui n'existe pas.
 * Le formulaire mène à la liste des réunions filtrée (`?q=`), ce qui rend
 * la recherche partageable et rechargeable.
 */
export function GlobalSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const { meetings, bookings } = useDashboardData();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);
  const containerRef = useDismissable<HTMLDivElement>(isOpen, close);

  const people = useMemo(() => buildPeople(user, bookings), [user, bookings]);

  const needle = query.trim().toLowerCase();

  const meetingHits = useMemo(() => {
    if (!needle) return [];
    return meetings
      .filter(
        (meeting) =>
          meeting.title.toLowerCase().includes(needle) ||
          meeting.joinCode.toLowerCase().includes(needle)
      )
      .slice(0, MAX_MEETINGS);
  }, [meetings, needle]);

  const peopleHits = useMemo(() => {
    if (!needle) return [];
    return people.filter((person) => person.name.toLowerCase().includes(needle)).slice(0, MAX_PEOPLE);
  }, [people, needle]);

  const resultCount = meetingHits.length + peopleHits.length;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!needle) return;
    navigate(`/dashboard/meetings?q=${encodeURIComponent(query.trim())}`);
    close();
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <form role="search" onSubmit={handleSubmit}>
        <label htmlFor="dash-search" className="sr-only">
          Rechercher une réunion ou une personne
        </label>
        <div className="relative">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--dash-text-subtle)" }}
          />
          <input
            id="dash-search"
            type="search"
            value={query}
            autoFocus={autoFocus}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(event.target.value.trim().length > 0);
            }}
            onFocus={() => setIsOpen(query.trim().length > 0)}
            placeholder="Rechercher…"
            className="dash-input pl-9"
            aria-describedby="dash-search-status"
          />
        </div>
        <p id="dash-search-status" className="sr-only" role="status">
          {needle
            ? `${resultCount} résultat${resultCount > 1 ? "s" : ""}`
            : "Saisissez un titre de réunion, un code, ou un nom."}
        </p>
      </form>

      {isOpen && needle.length > 0 && (
        <div
          className="dash-card absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[60vh] overflow-y-auto py-2"
          style={{ boxShadow: "var(--dash-shadow-lg)" }}
        >
          {resultCount === 0 && (
            <p className="px-4 py-3 text-[12.5px]" style={{ color: "var(--dash-text-muted)" }}>
              Aucun résultat parmi vos réunions et vos séances.
            </p>
          )}

          {meetingHits.length > 0 && (
            <>
              <p className="dash-nav-group-label px-4 pb-1 pt-2">Réunions</p>
              <ul>
                {meetingHits.map((meeting) => (
                  <li key={meeting.meetingId}>
                    <Link
                      to="/dashboard/meetings"
                      onClick={close}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-[var(--dash-surface-2)]"
                    >
                      <Video size={14} aria-hidden="true" style={{ color: "var(--dash-text-subtle)" }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px]" style={{ color: "var(--dash-text)" }}>
                          {meeting.title}
                        </span>
                        <span className="block truncate font-mono text-[11px]" style={{ color: "var(--dash-text-subtle)" }}>
                          {meeting.joinCode}
                        </span>
                      </span>
                      <span className={`dash-badge dash-badge-${MEETING_STATUS_STYLE[meeting.status].tone}`}>
                        {MEETING_STATUS_STYLE[meeting.status].label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {peopleHits.length > 0 && (
            <>
              <p className="dash-nav-group-label px-4 pb-1 pt-2">Personnes</p>
              <ul>
                {peopleHits.map((person) => (
                  <li key={person.id}>
                    <Link
                      to="/dashboard/users"
                      onClick={close}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-[var(--dash-surface-2)]"
                    >
                      <UsersIcon size={14} aria-hidden="true" style={{ color: "var(--dash-text-subtle)" }} />
                      <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--dash-text)" }}>
                        {person.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {resultCount > 0 && (
            <p
              className="mt-1 px-4 pb-1 pt-2 text-[11px]"
              style={{ color: "var(--dash-text-subtle)", borderTop: "1px solid var(--dash-border)" }}
            >
              Entrée pour filtrer la liste des réunions
            </p>
          )}
        </div>
      )}
    </div>
  );
}
