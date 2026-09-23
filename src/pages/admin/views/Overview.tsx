import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CalendarPlus,
  Clock,
  LogIn,
  Plus,
  Radio,
  Users,
  Video,
} from "lucide-react";
import { createMeeting } from "../../../lib/meetingApi";
import { useDashboardData } from "../context/DashboardDataContext";
import {
  buildActivity,
  buildDurationSeries,
  buildStatusBreakdown,
  computeKpis,
} from "../lib/derive";
import { formatDate, formatDuration, formatNumber, formatRelative, formatTime } from "../lib/format";
import { Card } from "../components/Card";
import { KpiCard } from "../components/KpiCard";
import { Notice } from "../components/Notice";
import { EmptyState } from "../components/EmptyState";
import { BarList, ColumnChart, type BarListItem, type ColumnDatum } from "../components/Charts";

/**
 * Vue d'ensemble.
 *
 * Chaque chiffre affiché est calculé à partir des données réellement
 * chargées. Là où la donnée n'existe pas — le nombre total d'utilisateurs de
 * la plateforme, par exemple — la carte affiche « N/A » et l'explique,
 * plutôt que de montrer un zéro qui se lirait comme une mesure.
 */
export function OverviewView() {
  const { meetings, bookings, loading, error, reload, refreshing } = useDashboardData();
  const navigate = useNavigate();

  const [isCreating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");

  const kpis = useMemo(() => computeKpis(meetings, bookings), [meetings, bookings]);
  const statusBreakdown = useMemo(() => buildStatusBreakdown(meetings), [meetings]);
  const durationSeries = useMemo(() => buildDurationSeries(meetings, 8), [meetings]);
  const activity = useMemo(() => buildActivity(meetings, bookings, 8), [meetings, bookings]);

  const barItems: BarListItem[] = statusBreakdown.map((slice) => ({
    id: slice.status,
    label: slice.label,
    value: slice.count,
    tone: slice.tone,
  }));

  const columns: ColumnDatum[] = durationSeries.map((bar) => ({
    id: bar.id,
    label: formatTime(bar.startedAt),
    value: bar.durationMs,
    valueLabel: formatDuration(bar.durationMs) ?? "—",
    caption: `${bar.title} — ${formatDate(bar.startedAt)}, ${formatDuration(bar.durationMs) ?? "durée inconnue"}`,
  }));

  const totalMeetingTime = formatDuration(kpis.meetingTimeMs);

  async function handleCreateMeeting() {
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createMeeting();
      navigate(`/room/${created.roomId}`);
    } catch {
      setCreateError("La réunion n'a pas pu être créée. Vérifie ta connexion et réessaie.");
    } finally {
      setCreating(false);
    }
  }

  function handleJoin(event: React.FormEvent) {
    event.preventDefault();
    const code = joinCode.trim();
    if (!code) return;
    navigate(`/room/${code}`);
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <Notice tone="warning" title={error}>
          {refreshing ? "Nouvelle tentative en cours…" : "Les valeurs affichées peuvent être incomplètes."}{" "}
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

      {/* ---------- Indicateurs ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          icon={<Users size={14} />}
          label="Utilisateurs"
          value="N/A"
          unavailable
          hint="Le répertoire global des comptes n'est pas exposé par l'API."
        />
        <KpiCard
          icon={<Video size={14} />}
          label="Réunions"
          value={formatNumber(kpis.meetingsTotal)}
          loading={loading}
          hint={
            kpis.meetingsTruncated
              ? "Plafonné aux 20 plus récentes par l'API."
              : "Vos réunions, toutes périodes."
          }
        />
        <KpiCard
          icon={<Radio size={14} />}
          label="Réunions actives"
          value={formatNumber(kpis.meetingsInProgress)}
          loading={loading}
          hint="Statut « En cours »."
        />
        <KpiCard
          icon={<Clock size={14} />}
          label="Temps de réunion"
          value={totalMeetingTime ?? "N/A"}
          unavailable={!loading && totalMeetingTime === null}
          loading={loading}
          hint={
            kpis.meetingsWithDuration > 0
              ? `Mesuré sur ${kpis.meetingsWithDuration} réunion${kpis.meetingsWithDuration > 1 ? "s" : ""} horodatée${kpis.meetingsWithDuration > 1 ? "s" : ""}.`
              : "Aucune réunion horodatée pour l'instant."
          }
        />
        <KpiCard
          icon={<Activity size={14} />}
          label="Activité (7 j)"
          value={formatNumber(kpis.activityLast7Days)}
          loading={loading}
          hint="Réunions lancées et séances tenues."
        />
      </div>

      {/* ---------- Actions rapides ---------- */}
      <Card
        title="Actions rapides"
        description="Uniquement des actions réellement disponibles dans Amphix Meet."
      >
        <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-start">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCreateMeeting}
              disabled={isCreating}
              className="dash-btn dash-btn-primary"
            >
              <Plus size={15} aria-hidden="true" />
              {isCreating ? "Création…" : "Nouvelle réunion"}
            </button>

            <Link to="/" className="dash-btn dash-btn-secondary">
              <CalendarPlus size={15} aria-hidden="true" />
              Réserver une séance
            </Link>

            <Link to="/dashboard/meetings" className="dash-btn dash-btn-ghost">
              Toutes mes réunions
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          <form onSubmit={handleJoin} className="flex items-end gap-2 lg:ml-auto">
            <div>
              <label
                htmlFor="dash-join-code"
                className="mb-1 block text-[11.5px] font-medium"
                style={{ color: "var(--dash-text-muted)" }}
              >
                Rejoindre avec un code
              </label>
              <input
                id="dash-join-code"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder="abc-defg-hij"
                className="dash-input w-[190px] font-mono"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={!joinCode.trim()}
              className="dash-btn dash-btn-secondary"
            >
              <LogIn size={15} aria-hidden="true" />
              Rejoindre
            </button>
          </form>
        </div>
        {createError && (
          <div className="px-4 pb-4">
            <Notice tone="warning" title={createError} />
          </div>
        )}
      </Card>

      {/* ---------- Graphiques ---------- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Répartition de vos réunions"
          description="Par statut, sur les réunions renvoyées par l'API."
        >
          {loading ? (
            <div className="px-4 py-4">
              <div className="dash-skeleton h-24 w-full" />
            </div>
          ) : barItems.length === 0 ? (
            <EmptyState
              icon={<Video size={16} />}
              title="Aucune réunion à répartir"
              description="Ce graphique s'appuiera sur vos réunions dès la première."
            />
          ) : (
            <BarList items={barItems} unitLabel="réunions" />
          )}
        </Card>

        <Card
          title="Durée des dernières réunions"
          description="Calculée entre l'ouverture et la fermeture de chaque réunion."
        >
          {loading ? (
            <div className="px-4 py-4">
              <div className="dash-skeleton h-40 w-full" />
            </div>
          ) : columns.length === 0 ? (
            <EmptyState
              icon={<Clock size={16} />}
              title="Aucune durée mesurable"
              description="Une réunion ne devient mesurable qu'une fois ouverte : l'horodatage de début est alors enregistré."
            />
          ) : (
            <ColumnChart
              data={columns}
              ariaLabel={`Durée de vos ${columns.length} dernières réunions mesurables`}
            />
          )}
        </Card>
      </div>

      {/* ---------- Activité récente ---------- */}
      <Card
        title="Activité récente"
        description="Vos réunions et vos séances, du plus récent au plus ancien."
      >
        {loading ? (
          <ul className="px-4 py-4">
            {[0, 1, 2].map((key) => (
              <li key={key} className="py-2">
                <div className="dash-skeleton h-9 w-full" />
              </li>
            ))}
          </ul>
        ) : activity.length === 0 ? (
          <EmptyState
            icon={<Activity size={16} />}
            title="Aucune activité enregistrée"
            description="Aucune réunion ni séance ne figure encore dans votre espace."
          />
        ) : (
          <ul>
            {activity.map((entry) => {
              const content = (
                <>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[13px] font-medium"
                      style={{ color: "var(--dash-text)" }}
                    >
                      {entry.title}
                    </span>
                    <span
                      className="mt-0.5 block truncate text-[11.5px]"
                      style={{ color: "var(--dash-text-muted)" }}
                    >
                      {entry.detail}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: "var(--dash-text-subtle)" }}>
                    {formatRelative(entry.at)}
                  </span>
                </>
              );

              return (
                <li key={entry.id} style={{ borderBottom: "1px solid var(--dash-border)" }}>
                  {entry.to ? (
                    <Link
                      to={entry.to}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--dash-surface-2)]"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ---------- Ce que l'API ne fournit pas ---------- */}
      <Notice title="Ce que cet espace ne peut pas encore afficher">
        L'API actuelle expose vos réunions et vos séances, pas les données de la plateforme
        entière. Les totaux d'utilisateurs, le journal global d'activité, l'historique
        statistique et les applications tierces demanderaient des points d'entrée dédiés, qui
        n'existent pas côté serveur. Aucune valeur n'est estimée à leur place.
      </Notice>
    </div>
  );
}
