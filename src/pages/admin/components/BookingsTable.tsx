import { Link } from "react-router-dom";
import { CalendarClock, LogIn } from "lucide-react";
import type { BookingSummary } from "../../../lib/bookingApi";
import { BOOKING_STATUS_STYLE } from "../lib/derive";
import { formatDateTime, UNAVAILABLE } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "./EmptyState";

/**
 * Tableau des séances réservées.
 *
 * « Interlocuteur » est calculé, pas deviné : la réservation porte les deux
 * identifiants, on affiche donc l'AUTRE partie. Afficher systématiquement
 * `teacherName` aurait montré votre propre nom aux professeurs.
 */
export function BookingsTable({
  bookings,
  meId,
  emptyTitle,
  emptyDescription,
}: {
  bookings: BookingSummary[];
  meId: string | undefined;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock size={16} />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="dash-table">
        <caption className="sr-only">Liste de vos séances réservées</caption>
        <thead>
          <tr>
            <th scope="col">Séance</th>
            <th scope="col">Interlocuteur</th>
            <th scope="col">Statut</th>
            <th scope="col">Date</th>
            <th scope="col">Durée</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => {
            const style = BOOKING_STATUS_STYLE[booking.status];
            const isStudent = booking.studentId === meId;
            const counterpart = isStudent ? booking.teacherName : booking.studentName;
            const canJoin =
              Boolean(booking.meetingJoinCode) &&
              (booking.status === "CONFIRMED" || booking.status === "IN_PROGRESS");

            return (
              <tr key={booking.id}>
                <td>
                  <span
                    className="block max-w-[240px] truncate font-medium"
                    style={{ color: "var(--dash-text)" }}
                    title={booking.subject}
                  >
                    {booking.subject}
                  </span>
                  <span className="text-[11.5px]" style={{ color: "var(--dash-text-subtle)" }}>
                    {isStudent ? "Vous êtes élève" : "Vous êtes professeur"}
                  </span>
                </td>
                <td>
                  <span className="text-[12.5px]" style={{ color: "var(--dash-text-muted)" }}>
                    {counterpart || UNAVAILABLE}
                  </span>
                </td>
                <td>
                  <StatusBadge tone={style.tone} label={style.label} />
                </td>
                <td>
                  <span
                    className="whitespace-nowrap text-[12.5px]"
                    style={{ color: "var(--dash-text-muted)" }}
                  >
                    {formatDateTime(booking.startsAt)}
                  </span>
                </td>
                <td>
                  <span
                    className="whitespace-nowrap text-[12.5px] tabular-nums"
                    style={{ color: "var(--dash-text-muted)" }}
                  >
                    {booking.durationMinutes} min
                  </span>
                </td>
                <td>
                  {canJoin && booking.meetingJoinCode && (
                    <Link
                      to={`/room/${booking.meetingJoinCode}`}
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
