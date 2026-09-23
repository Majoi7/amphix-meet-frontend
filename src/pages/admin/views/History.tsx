import { useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useDashboardData } from "../context/DashboardDataContext";
import { Card } from "../components/Card";
import { Notice } from "../components/Notice";
import { MeetingsTable } from "../components/MeetingsTable";
import { BookingsTable } from "../components/BookingsTable";

/**
 * Historique.
 *
 * Deux sources réelles, aucune reconstitution : les réunions closes
 * (`GET /meetings/mine` renvoie leur statut et leurs horodatages) et les
 * séances dont la date est passée. Une séance « confirmée » dont l'heure est
 * passée est affichée comme telle — c'est son statut réel, et le corriger
 * côté interface reviendrait à inventer une donnée.
 */
export function HistoryView() {
  const { meetings, bookings, loading, error, reload } = useDashboardData();
  const { user } = useAuth();

  const closedMeetings = useMemo(
    () =>
      meetings.filter(
        (meeting) => meeting.status === "COMPLETED" || meeting.status === "CANCELLED"
      ),
    [meetings]
  );

  const pastBookings = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter((booking) => {
        const startsAt = new Date(booking.startsAt).getTime();
        return !Number.isNaN(startsAt) && startsAt < now;
      })
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }, [bookings]);

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

      <Card
        title="Réunions terminées ou annulées"
        description={
          loading ? "Chargement…" : `${closedMeetings.length} réunion${closedMeetings.length > 1 ? "s" : ""} close${closedMeetings.length > 1 ? "s" : ""}`
        }
      >
        {loading ? (
          <div className="px-4 py-4">
            {[0, 1, 2].map((key) => (
              <div key={key} className="dash-skeleton my-2 h-10 w-full" />
            ))}
          </div>
        ) : (
          <MeetingsTable
            meetings={closedMeetings}
            emptyTitle="Aucune réunion close"
            emptyDescription="Les réunions terminées ou annulées apparaîtront ici."
          />
        )}
      </Card>

      <Card
        title="Séances passées"
        description={
          loading ? "Chargement…" : `${pastBookings.length} séance${pastBookings.length > 1 ? "s" : ""} dont la date est passée`
        }
      >
        {loading ? (
          <div className="px-4 py-4">
            {[0, 1, 2].map((key) => (
              <div key={key} className="dash-skeleton my-2 h-10 w-full" />
            ))}
          </div>
        ) : (
          <BookingsTable
            bookings={pastBookings}
            meId={user?.id}
            emptyTitle="Aucune séance passée"
            emptyDescription="Vos séances réservées apparaîtront ici une fois leur date passée."
          />
        )}
      </Card>

      <Notice title="Portée de cet historique">
        L'API renvoie au maximum les 20 réunions les plus récentes auxquelles vous avez
        participé. Un historique plus ancien, ou couvrant l'ensemble de la plateforme,
        demanderait un point d'entrée serveur dédié.
      </Notice>
    </div>
  );
}
