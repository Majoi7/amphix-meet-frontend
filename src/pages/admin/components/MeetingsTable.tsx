import { Link } from "react-router-dom";
import { LogIn, Video } from "lucide-react";
import type { MeetingListItem } from "../../../lib/meetingApi";
import { MEETING_STATUS_STYLE, meetingDurationMs } from "../lib/derive";
import { formatDate, formatDurationOrDash, UNAVAILABLE } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "./EmptyState";

/**
 * Tableau des réunions.
 *
 * Partagé par « Réunions » et « Historique » : les deux pages montrent les
 * mêmes lignes, seuls les filtres changent. Deux tableaux séparés auraient
 * fini par afficher des colonnes différentes pour la même donnée.
 *
 * La colonne « Participants » reste vide et l'assume : le nombre de
 * participants d'une réunion n'est exposé par aucune API en dehors de la
 * salle elle-même. Elle figure quand même, avec son infobulle explicative,
 * pour que l'absence soit lisible — une colonne supprimée se serait
 * confondue avec un oubli.
 */
export function MeetingsTable({
  meetings,
  emptyTitle,
  emptyDescription,
}: {
  meetings: MeetingListItem[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (meetings.length === 0) {
    return <EmptyState icon={<Video size={16} />} title={emptyTitle} description={emptyDescription} />;
  }

  const now = Date.now();

  return (
    <div className="overflow-x-auto">
      <table className="dash-table">
        <caption className="sr-only">Liste de vos réunions</caption>
        <thead>
          <tr>
            <th scope="col">Réunion</th>
            <th scope="col">Hôte</th>
            <th scope="col">Statut</th>
            <th scope="col">Créée le</th>
            <th scope="col">Durée</th>
            <th scope="col" title="Non exposé par l'API">
              Participants
            </th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {meetings.map((meeting) => {
            const style = MEETING_STATUS_STYLE[meeting.status];
            const duration = formatDurationOrDash(meetingDurationMs(meeting, now));
            const isJoinable =
              meeting.status === "IN_PROGRESS" || meeting.status === "SCHEDULED";

            return (
              <tr key={meeting.meetingId}>
                <td>
                  <span
                    className="block max-w-[260px] truncate font-medium"
                    style={{ color: "var(--dash-text)" }}
                    title={meeting.title}
                  >
                    {meeting.title}
                  </span>
                  <span className="font-mono text-[11.5px]" style={{ color: "var(--dash-text-subtle)" }}>
                    {meeting.joinCode}
                  </span>
                </td>
                <td>
                  <span className="text-[12.5px]" style={{ color: "var(--dash-text-muted)" }}>
                    {meeting.hostName}
                    {meeting.isHost && (
                      <span style={{ color: "var(--dash-text-subtle)" }}> (vous)</span>
                    )}
                  </span>
                </td>
                <td>
                  <StatusBadge tone={style.tone} label={style.label} />
                </td>
                <td>
                  <span className="whitespace-nowrap text-[12.5px]" style={{ color: "var(--dash-text-muted)" }}>
                    {formatDate(meeting.createdAt)}
                  </span>
                </td>
                <td>
                  <span className="whitespace-nowrap text-[12.5px] tabular-nums" style={{ color: "var(--dash-text-muted)" }}>
                    {duration}
                  </span>
                </td>
                <td>
                  <span
                    className="text-[12.5px]"
                    style={{ color: "var(--dash-text-subtle)" }}
                    title="Le nombre de participants n'est pas exposé par l'API."
                  >
                    {UNAVAILABLE}
                  </span>
                </td>
                <td>
                  {isJoinable && (
                    <Link
                      to={`/room/${meeting.joinCode}`}
                      className="dash-btn dash-btn-secondary h-8 px-3 text-[12.5px]"
                    >
                      <LogIn size={13} aria-hidden="true" />
                      Rejoindre
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
