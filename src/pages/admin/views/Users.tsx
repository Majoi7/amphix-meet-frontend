import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Search, UserCog, Users as UsersIcon } from "lucide-react";
import type { UserRole } from "../../../types";
import { useAuth } from "../../../context/AuthContext";
import { getAvatarColor } from "../../../lib/avatarColor";
import { useDashboardData } from "../context/DashboardDataContext";
import { buildPeople, ROLE_LABEL } from "../lib/derive";
import { formatDate, initialsOf, NOT_EXPOSED, UNAVAILABLE } from "../lib/format";
import { Card } from "../components/Card";
import { Notice } from "../components/Notice";
import { EmptyState } from "../components/EmptyState";
import { Pagination } from "../components/Pagination";

const PAGE_SIZE = 10;

const ROLE_OPTIONS: Array<{ value: UserRole | "ALL"; label: string }> = [
  { value: "ALL", label: "Tous les rôles" },
  { value: "STUDENT", label: ROLE_LABEL.STUDENT },
  { value: "TEACHER", label: ROLE_LABEL.TEACHER },
  { value: "ADMIN", label: ROLE_LABEL.ADMIN },
];

/**
 * Utilisateurs.
 *
 * Il n'existe AUCUN point d'entrée renvoyant l'annuaire de la plateforme :
 * l'administration ne peut donc pas lister tous les comptes. Elle affiche ce
 * qui est réellement accessible — votre compte, puis les personnes avec qui
 * vous avez une séance, déduites de `GET /bookings/mine` (identifiant, nom,
 * rôle).
 *
 * Les colonnes « Email », « Inscription » et « Dernière activité » sont
 * présentes mais marquées comme non exposées : la base les contient, l'API
 * ne les renvoie pas. Les masquer aurait laissé croire qu'elles n'existent
 * pas.
 */
export function UsersView() {
  const { bookings, loading, error, reload } = useDashboardData();
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [role, setRole] = useState<UserRole | "ALL">("ALL");
  const [page, setPage] = useState(1);

  const people = useMemo(() => buildPeople(user, bookings), [user, bookings]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return people.filter((person) => {
      if (role !== "ALL" && person.role !== role) return false;
      if (!needle) return true;
      return person.name.toLowerCase().includes(needle);
    });
  }, [people, query, role]);

  useEffect(() => {
    setPage(1);
  }, [query, role]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

      {/* ---------- Votre compte ---------- */}
      {user && (
        <Card
          title="Votre compte"
          description="Informations renvoyées par GET /auth/me."
          action={
            <Link to="/profile" className="dash-btn dash-btn-secondary">
              <UserCog size={15} aria-hidden="true" />
              Modifier mon profil
            </Link>
          }
        >
          <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-black"
                  style={{ backgroundColor: getAvatarColor(user.id) }}
                  aria-hidden="true"
                >
                  {initialsOf(user.name)}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold" style={{ color: "var(--dash-text)" }}>
                  {user.name}
                </p>
                <p className="truncate text-[12.5px]" style={{ color: "var(--dash-text-muted)" }}>
                  {user.email}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:ml-auto sm:grid-cols-3">
              <div>
                <dt className="text-[11px]" style={{ color: "var(--dash-text-subtle)" }}>
                  Rôle
                </dt>
                <dd className="text-[12.5px] font-medium" style={{ color: "var(--dash-text)" }}>
                  {ROLE_LABEL[user.role]}
                </dd>
              </div>
              <div>
                <dt className="text-[11px]" style={{ color: "var(--dash-text-subtle)" }}>
                  Adresse vérifiée
                </dt>
                <dd
                  className="flex items-center gap-1 text-[12.5px] font-medium"
                  style={{ color: user.emailVerified ? "var(--dash-green)" : "var(--dash-text-muted)" }}
                >
                  {user.emailVerified && <BadgeCheck size={13} aria-hidden="true" />}
                  {user.emailVerified ? "Oui" : "Non"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px]" style={{ color: "var(--dash-text-subtle)" }}>
                  Inscription
                </dt>
                <dd
                  className="text-[12.5px]"
                  style={{ color: "var(--dash-text-subtle)" }}
                  title="La date de création du compte n'est pas renvoyée par GET /auth/me."
                >
                  {NOT_EXPOSED}
                </dd>
              </div>
            </dl>
          </div>
        </Card>
      )}

      {/* ---------- Personnes de vos séances ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-[280px]">
          <label
            htmlFor="users-search"
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
              id="users-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom…"
              className="dash-input pl-9"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="users-role"
            className="mb-1 block text-[11.5px] font-medium"
            style={{ color: "var(--dash-text-muted)" }}
          >
            Rôle
          </label>
          <select
            id="users-role"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole | "ALL")}
            className="dash-select w-full sm:w-[180px]"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card
        title="Personnes de vos séances"
        description={
          loading
            ? "Chargement…"
            : `${filtered.length} personne${filtered.length > 1 ? "s" : ""}`
        }
      >
        {loading ? (
          <div className="px-4 py-4">
            {[0, 1, 2].map((key) => (
              <div key={key} className="dash-skeleton my-2 h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<UsersIcon size={16} />}
            title={query || role !== "ALL" ? "Aucune personne ne correspond" : "Aucune personne"}
            description={
              query || role !== "ALL"
                ? "Élargis la recherche ou réinitialise le filtre de rôle."
                : "Vos interlocuteurs de séances apparaîtront ici dès votre première réservation."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="dash-table">
              <caption className="sr-only">Personnes connues de votre espace</caption>
              <thead>
                <tr>
                  <th scope="col">Nom</th>
                  <th scope="col" title="Non exposé par l'API">
                    Email
                  </th>
                  <th scope="col">Rôle</th>
                  <th scope="col">Origine</th>
                  <th scope="col">Séances en commun</th>
                  <th scope="col">Dernière séance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-black"
                          style={{ backgroundColor: getAvatarColor(person.id) }}
                          aria-hidden="true"
                        >
                          {initialsOf(person.name)}
                        </span>
                        <span className="min-w-0">
                          <span
                            className="block max-w-[200px] truncate font-medium"
                            style={{ color: "var(--dash-text)" }}
                          >
                            {person.name}
                          </span>
                          {person.isSelf && (
                            <span className="text-[11px]" style={{ color: "var(--dash-text-subtle)" }}>
                              Vous
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="text-[12.5px]"
                        style={{ color: "var(--dash-text-subtle)" }}
                        title="L'adresse e-mail des autres comptes n'est pas renvoyée par l'API."
                      >
                        {person.isSelf ? user?.email ?? UNAVAILABLE : NOT_EXPOSED}
                      </span>
                    </td>
                    <td>
                      <span className="text-[12.5px]" style={{ color: "var(--dash-text-muted)" }}>
                        {person.role ? ROLE_LABEL[person.role] : UNAVAILABLE}
                      </span>
                    </td>
                    <td>
                      <span className="text-[12.5px]" style={{ color: "var(--dash-text-muted)" }}>
                        {person.isSelf ? "Votre compte" : "Séance réservée"}
                      </span>
                    </td>
                    <td>
                      <span className="text-[12.5px] tabular-nums" style={{ color: "var(--dash-text-muted)" }}>
                        {person.isSelf ? UNAVAILABLE : person.sharedSessions}
                      </span>
                    </td>
                    <td>
                      <span
                        className="whitespace-nowrap text-[12.5px]"
                        style={{ color: "var(--dash-text-muted)" }}
                      >
                        {person.lastSessionAt ? formatDate(person.lastSessionAt) : UNAVAILABLE}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
        )}
      </Card>

      <Notice title="Pourquoi cette liste est restreinte">
        Aucun point d'entrée ne renvoie l'annuaire des comptes : seuls votre compte et les
        personnes liées à vos réservations sont connus. Les hôtes des réunions auxquelles
        vous avez participé n'y figurent pas, car l'API ne transmet que leur nom — sans
        identifiant, deux homonymes seraient fusionnés en une seule ligne.
      </Notice>
    </div>
  );
}
