import type { AuthUser, UserRole } from "../../../types";
import type { MeetingListItem } from "../../../lib/meetingApi";
import type { BookingSummary } from "../../../lib/bookingApi";

/* ══════════════════════════════════════════════════════════════════════
   Vocabulaire partagé des statuts
   Une seule table de correspondance : le même statut porte donc EXACTEMENT
   la même couleur et le même libellé sur la vue d'ensemble, la liste des
   réunions et l'historique. Deux tables séparées finiraient par diverger.
   ══════════════════════════════════════════════════════════════════════ */

export type MeetingStatus = MeetingListItem["status"];

export interface StatusStyle {
  label: string;
  /** Classe d'étiquette de `dashboard.css`. */
  tone: "green" | "blue" | "slate" | "red" | "amber";
}

export const MEETING_STATUS_STYLE: Record<MeetingStatus, StatusStyle> = {
  IN_PROGRESS: { label: "En cours", tone: "green" },
  SCHEDULED: { label: "Planifiée", tone: "blue" },
  COMPLETED: { label: "Terminée", tone: "slate" },
  CANCELLED: { label: "Annulée", tone: "red" },
};

export const BOOKING_STATUS_STYLE: Record<BookingSummary["status"], StatusStyle> = {
  PENDING: { label: "En attente", tone: "amber" },
  CONFIRMED: { label: "Confirmée", tone: "blue" },
  IN_PROGRESS: { label: "En cours", tone: "green" },
  COMPLETED: { label: "Terminée", tone: "slate" },
  CANCELLED: { label: "Annulée", tone: "red" },
  NO_SHOW: { label: "Absence", tone: "red" },
};

export const ROLE_LABEL: Record<UserRole, string> = {
  STUDENT: "Élève",
  TEACHER: "Professeur",
  ADMIN: "Administrateur",
};

/* ══════════════════════════════════════════════════════════════════════
   Durées
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Durée réelle d'une réunion, en millisecondes.
 *
 * Elle est CALCULÉE à partir de `startedAt` / `endedAt`, deux colonnes qui
 * existent déjà en base et que `GET /meetings/mine` renvoie réellement.
 * Rien n'est estimé : une réunion jamais démarrée (`startedAt` nul) ou
 * terminée sans horodatage de fin renvoie `null`, et l'interface affiche
 * « — » plutôt qu'un chiffre inventé.
 */
export function meetingDurationMs(
  meeting: MeetingListItem,
  now = Date.now()
): number | null {
  if (!meeting.startedAt) return null;

  const start = new Date(meeting.startedAt).getTime();
  if (Number.isNaN(start)) return null;

  let end: number | null = null;
  if (meeting.endedAt) {
    end = new Date(meeting.endedAt).getTime();
  } else if (meeting.status === "IN_PROGRESS") {
    end = now; // réunion en cours : la durée court encore
  }

  if (end === null || Number.isNaN(end)) return null;
  const delta = end - start;
  return delta > 0 ? delta : null;
}

/* ══════════════════════════════════════════════════════════════════════
   Indicateurs de la vue d'ensemble
   ══════════════════════════════════════════════════════════════════════ */

/** `GET /meetings/mine` renvoie au plus 20 lignes (voir `meetingService`). */
export const MEETINGS_API_LIMIT = 20;
/** `GET /bookings/mine` n'est pas plafonné côté service, mais reste borné. */
export const BOOKINGS_API_LIMIT = 100;

export interface DashboardKpis {
  meetingsTotal: number;
  meetingsInProgress: number;
  /** Somme des durées RÉELLEMENT mesurables. */
  meetingTimeMs: number;
  /** Combien de réunions ont une durée mesurable (dénominateur honnête). */
  meetingsWithDuration: number;
  bookingsUpcoming: number;
  bookingsPending: number;
  activityLast7Days: number;
  /** Vrai si la liste reçue atteint la limite de l'API : les totaux sont
   *  alors des minimums, pas des totaux exacts. L'interface le signale. */
  meetingsTruncated: boolean;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function computeKpis(
  meetings: MeetingListItem[],
  bookings: BookingSummary[],
  now = Date.now()
): DashboardKpis {
  let meetingTimeMs = 0;
  let meetingsWithDuration = 0;
  let meetingsInProgress = 0;
  let activityLast7Days = 0;

  for (const meeting of meetings) {
    if (meeting.status === "IN_PROGRESS") meetingsInProgress += 1;

    const duration = meetingDurationMs(meeting, now);
    if (duration !== null) {
      meetingTimeMs += duration;
      meetingsWithDuration += 1;
    }

    const activityAt = meeting.startedAt ?? meeting.createdAt;
    const activityTime = activityAt ? new Date(activityAt).getTime() : NaN;
    if (!Number.isNaN(activityTime) && now - activityTime <= SEVEN_DAYS_MS) {
      activityLast7Days += 1;
    }
  }

  let bookingsUpcoming = 0;
  let bookingsPending = 0;

  for (const booking of bookings) {
    if (booking.status === "PENDING") bookingsPending += 1;
    if (booking.status === "CONFIRMED" || booking.status === "PENDING") {
      const startsAt = new Date(booking.startsAt).getTime();
      if (!Number.isNaN(startsAt) && startsAt > now) bookingsUpcoming += 1;
    }

    const startsAt = new Date(booking.startsAt).getTime();
    if (!Number.isNaN(startsAt) && now - startsAt <= SEVEN_DAYS_MS && startsAt <= now) {
      activityLast7Days += 1;
    }
  }

  return {
    meetingsTotal: meetings.length,
    meetingsInProgress,
    meetingTimeMs,
    meetingsWithDuration,
    bookingsUpcoming,
    bookingsPending,
    activityLast7Days,
    meetingsTruncated: meetings.length >= MEETINGS_API_LIMIT,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Séries pour les graphiques
   ══════════════════════════════════════════════════════════════════════ */

export interface StatusSlice {
  status: MeetingStatus;
  label: string;
  tone: StatusStyle["tone"];
  count: number;
}

/** Répartition de VOS réunions par statut. Les statuts à zéro sont omis :
 *  une barre vide n'apprend rien et laisse croire à une donnée manquante. */
export function buildStatusBreakdown(meetings: MeetingListItem[]): StatusSlice[] {
  const order: MeetingStatus[] = ["IN_PROGRESS", "SCHEDULED", "COMPLETED", "CANCELLED"];
  const counts = new Map<MeetingStatus, number>();
  for (const meeting of meetings) {
    counts.set(meeting.status, (counts.get(meeting.status) ?? 0) + 1);
  }
  return order
    .filter((status) => (counts.get(status) ?? 0) > 0)
    .map((status) => ({
      status,
      label: MEETING_STATUS_STYLE[status].label,
      tone: MEETING_STATUS_STYLE[status].tone,
      count: counts.get(status) ?? 0,
    }));
}

export interface DurationBar {
  id: string;
  /** Titre de la réunion, tronqué à l'affichage. */
  title: string;
  /** Date de début, pour l'infobulle. */
  startedAt: string | null;
  durationMs: number;
}

/**
 * Durées des réunions les plus récentes, de la plus ancienne à la plus
 * récente (sens de lecture d'un graphique temporel).
 */
export function buildDurationSeries(
  meetings: MeetingListItem[],
  limit = 8,
  now = Date.now()
): DurationBar[] {
  const withDuration: DurationBar[] = [];
  for (const meeting of meetings) {
    const durationMs = meetingDurationMs(meeting, now);
    if (durationMs === null) continue;
    withDuration.push({
      id: meeting.meetingId,
      title: meeting.title,
      startedAt: meeting.startedAt,
      durationMs,
    });
  }
  // `meetings` arrive du plus récent au plus ancien (createdAt desc).
  return withDuration.slice(0, limit).reverse();
}

/* ══════════════════════════════════════════════════════════════════════
   Personnes
   ══════════════════════════════════════════════════════════════════════ */

export interface PersonRow {
  id: string;
  name: string;
  role: UserRole | null;
  /** D'où vient la ligne : votre compte, ou vos séances. */
  origin: "self" | "booking";
  /** Nombre de séances partagées avec vous (donnée réelle des réservations). */
  sharedSessions: number;
  /** Date de la séance la plus récente, ou de la plus proche à venir. */
  lastSessionAt: string | null;
  isSelf: boolean;
}

/**
 * Personnes connues de l'application, dérivées de sources RÉELLES :
 *
 *  - votre propre compte (`GET /auth/me`, exposé par `useAuth`) ;
 *  - les participants de vos réservations (`GET /bookings/mine`), qui
 *    portent un identifiant, un nom et un rôle déductible.
 *
 * Les hôtes des réunions auxquelles vous avez participé ne sont PAS inclus :
 * `MeetingListItem` ne porte que `hostName`, sans identifiant. Les faire
 * figurer supposerait de les identifier par leur nom — deux personnes
 * homonymes seraient alors fusionnées en une seule ligne. Une liste
 * incomplète mais juste vaut mieux qu'une liste complète et fausse.
 */
export function buildPeople(
  me: AuthUser | null,
  bookings: BookingSummary[]
): PersonRow[] {
  const rows = new Map<string, PersonRow>();

  if (me) {
    rows.set(me.id, {
      id: me.id,
      name: me.name,
      role: me.role,
      origin: "self",
      sharedSessions: 0,
      lastSessionAt: null,
      isSelf: true,
    });
  }

  for (const booking of bookings) {
    const candidates: Array<{ id: string; name: string; role: UserRole }> = [
      { id: booking.studentId, name: booking.studentName, role: "STUDENT" },
      { id: booking.teacherId, name: booking.teacherName, role: "TEACHER" },
    ];

    for (const candidate of candidates) {
      if (!candidate.id || candidate.id === me?.id) continue;

      const existing = rows.get(candidate.id);
      if (existing) {
        existing.sharedSessions += 1;
        existing.lastSessionAt = latest(existing.lastSessionAt, booking.startsAt);
        continue;
      }

      rows.set(candidate.id, {
        id: candidate.id,
        name: candidate.name,
        role: candidate.role,
        origin: "booking",
        sharedSessions: 1,
        lastSessionAt: booking.startsAt,
        isSelf: false,
      });
    }
  }

  return Array.from(rows.values()).sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    if (b.sharedSessions !== a.sharedSessions) return b.sharedSessions - a.sharedSessions;
    return a.name.localeCompare(b.name, "fr");
  });
}

function latest(current: string | null, candidate: string): string {
  if (!current) return candidate;
  return new Date(candidate).getTime() > new Date(current).getTime() ? candidate : current;
}

/* ══════════════════════════════════════════════════════════════════════
   Activité récente
   ══════════════════════════════════════════════════════════════════════ */

export interface ActivityEntry {
  id: string;
  /** Horodatage réel, utilisé pour le tri et l'affichage relatif. */
  at: string;
  kind: "meeting" | "booking";
  title: string;
  detail: string;
  tone: StatusStyle["tone"];
  /** Destination interne, ou `null` si l'élément n'est pas navigable. */
  to: string | null;
}

/**
 * Flux d'activité, construit UNIQUEMENT à partir d'horodatages réels :
 * les réunions que vous avez lancées et vos séances réservées. Aucun
 * événement n'est inventé — s'il n'y a rien, la liste est vide et
 * l'interface le dit.
 */
export function buildActivity(
  meetings: MeetingListItem[],
  bookings: BookingSummary[],
  limit = 8
): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  for (const meeting of meetings) {
    const at = meeting.startedAt ?? meeting.createdAt;
    if (!at) continue;
    entries.push({
      id: `meeting-${meeting.meetingId}`,
      at,
      kind: "meeting",
      title: meeting.title,
      detail: meeting.isHost
        ? `Réunion que vous avez ouverte · ${MEETING_STATUS_STYLE[meeting.status].label}`
        : `Réunion de ${meeting.hostName} · ${MEETING_STATUS_STYLE[meeting.status].label}`,
      tone: MEETING_STATUS_STYLE[meeting.status].tone,
      to: meeting.status === "COMPLETED" || meeting.status === "CANCELLED"
        ? "/dashboard/history"
        : "/dashboard/meetings",
    });
  }

  for (const booking of bookings) {
    if (!booking.startsAt) continue;
    entries.push({
      id: `booking-${booking.id}`,
      at: booking.startsAt,
      kind: "booking",
      title: booking.subject,
      detail: `Séance avec ${booking.teacherId === booking.createdById ? booking.studentName : booking.teacherName} · ${BOOKING_STATUS_STYLE[booking.status].label}`,
      tone: BOOKING_STATUS_STYLE[booking.status].tone,
      to: booking.meetingJoinCode ? `/room/${booking.meetingJoinCode}` : null,
    });
  }

  return entries
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}
