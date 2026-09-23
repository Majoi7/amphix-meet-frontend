import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CalendarClock, Radio, UserCheck, type LucideIcon } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useDashboardData } from "../context/DashboardDataContext";
import { formatDateTime, formatRelative } from "../lib/format";
import { useDismissable } from "../lib/useDismissable";

interface NotificationEntry {
  id: string;
  Icon: LucideIcon;
  title: string;
  detail: string;
  to: string;
  at: string | null;
  tone: "green" | "blue" | "amber";
}

const TONE_CLASS: Record<NotificationEntry["tone"], string> = {
  green: "dash-badge-green",
  blue: "dash-badge-blue",
  amber: "dash-badge-amber",
};

/**
 * Notifications de l'administration.
 *
 * Amphix Meet n'a AUCUN service de notifications côté serveur : il n'existe
 * ni table d'événements, ni abonnement, ni envoi. Ce panneau ne les imite
 * donc pas. Il rassemble ce qui, dans les données réellement chargées,
 * demande une action ou mérite l'attention : les demandes de séance reçues,
 * les réunions en cours, et les séances confirmées à venir. La pastille
 * compte exactement ces éléments — pas un nombre inventé.
 */
export function NotificationsMenu() {
  const { meetings, bookings } = useDashboardData();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);
  const containerRef = useDismissable<HTMLDivElement>(isOpen, close);

  // Horloge à la minute : les libellés relatifs (« il y a 4 min ») et le
  // filtre « à venir » restent justes sans recharger la page. Une valeur
  // figée au montage vieillirait en silence.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const entries = useMemo<NotificationEntry[]>(() => {
    const list: NotificationEntry[] = [];

    // Demandes de séance reçues : en attente, et que vous n'avez pas créées.
    for (const booking of bookings) {
      if (booking.status !== "PENDING") continue;
      if (user && booking.createdById === user.id) continue;
      const requester =
        booking.createdById === booking.studentId ? booking.studentName : booking.teacherName;
      list.push({
        id: `request-${booking.id}`,
        Icon: UserCheck,
        title: `Demande de séance — ${booking.subject}`,
        detail: `Demandée par ${requester} · ${formatDateTime(booking.startsAt)}`,
        to: "/",
        at: booking.startsAt,
        tone: "amber",
      });
    }

    // Réunions en cours.
    for (const meeting of meetings) {
      if (meeting.status !== "IN_PROGRESS") continue;
      list.push({
        id: `live-${meeting.meetingId}`,
        Icon: Radio,
        title: meeting.title,
        detail: meeting.isHost
          ? "Votre réunion est en cours"
          : `Réunion de ${meeting.hostName} en cours`,
        to: `/room/${meeting.joinCode}`,
        at: meeting.startedAt ?? meeting.createdAt,
        tone: "green",
      });
    }

    // Séances confirmées à venir.
    for (const booking of bookings) {
      if (booking.status !== "CONFIRMED") continue;
      const startsAt = new Date(booking.startsAt).getTime();
      if (Number.isNaN(startsAt) || startsAt <= now) continue;
      list.push({
        id: `upcoming-${booking.id}`,
        Icon: CalendarClock,
        title: `Séance à venir — ${booking.subject}`,
        detail: `${formatDateTime(booking.startsAt)} · ${formatRelative(booking.startsAt, now)}`,
        to: booking.meetingJoinCode ? `/room/${booking.meetingJoinCode}` : "/",
        at: booking.startsAt,
        tone: "blue",
      });
    }

    return list
      .sort((a, b) => {
        const left = a.at ? new Date(a.at).getTime() : 0;
        const right = b.at ? new Date(b.at).getTime() : 0;
        return right - left;
      })
      .slice(0, 12);
  }, [meetings, bookings, user, now]);

  const count = entries.length;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={
          count > 0 ? `Notifications, ${count} élément${count > 1 ? "s" : ""}` : "Notifications"
        }
        className="dash-icon-btn relative"
      >
        <Bell size={17} aria-hidden="true" />
        {count > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums"
            style={{ backgroundColor: "var(--dash-accent)", color: "#1a1200" }}
            aria-hidden="true"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="dash-card absolute right-0 top-[calc(100%+6px)] z-50 w-[min(340px,calc(100vw-24px))] overflow-hidden"
          style={{ boxShadow: "var(--dash-shadow-lg)" }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid var(--dash-border)" }}
          >
            <p className="text-[13px] font-semibold" style={{ color: "var(--dash-text)" }}>
              Notifications
            </p>
            <span className="text-[11px]" style={{ color: "var(--dash-text-subtle)" }}>
              {count}
            </span>
          </div>

          {count === 0 ? (
            <p className="px-4 py-6 text-center text-[12.5px]" style={{ color: "var(--dash-text-muted)" }}>
              Rien à signaler pour le moment.
            </p>
          ) : (
            <ul className="max-h-[340px] overflow-y-auto">
              {entries.map((entry) => (
                <li key={entry.id} style={{ borderBottom: "1px solid var(--dash-border)" }}>
                  <Link
                    to={entry.to}
                    onClick={close}
                    className="flex gap-3 px-4 py-3 hover:bg-[var(--dash-surface-2)]"
                  >
                    <span
                      className={`dash-badge ${TONE_CLASS[entry.tone]} h-6 w-6 shrink-0 justify-center p-0`}
                      aria-hidden="true"
                    >
                      <entry.Icon size={13} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-[12.5px] font-medium"
                        style={{ color: "var(--dash-text)" }}
                      >
                        {entry.title}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug" style={{ color: "var(--dash-text-muted)" }}>
                        {entry.detail}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <p
            className="px-4 py-2.5 text-[11px] leading-snug"
            style={{ color: "var(--dash-text-subtle)", borderTop: "1px solid var(--dash-border)" }}
          >
            Liste dérivée de vos réunions et séances : Amphix Meet n'a pas de service de
            notifications côté serveur.
          </p>
        </div>
      )}
    </div>
  );
}
