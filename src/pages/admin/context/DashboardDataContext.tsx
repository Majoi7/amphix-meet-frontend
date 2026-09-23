import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { listMyMeetings, type MeetingListItem } from "../../../lib/meetingApi";
import { listMyBookings, type BookingSummary } from "../../../lib/bookingApi";
import { useAuth } from "../../../context/AuthContext";

interface DashboardDataValue {
  meetings: MeetingListItem[];
  bookings: BookingSummary[];
  /** Premier chargement en cours (aucune donnée encore disponible). */
  loading: boolean;
  /** Un rechargement est en cours alors que des données sont déjà affichées. */
  refreshing: boolean;
  /** Message d'erreur du DERNIER chargement, ou `null`. */
  error: string | null;
  /** Quelles sources ont échoué — l'interface le dit précisément. */
  failedSources: string[];
  reload: () => void;
  /** Horodatage du dernier chargement réussi, pour les rafraîchissements. */
  lastLoadedAt: number | null;
}

const DashboardDataContext = createContext<DashboardDataValue | null>(null);

/**
 * Source unique de données de l'espace d'administration.
 *
 * DEUX APPELS, PAS UN DE PLUS
 * `GET /meetings/mine` et `GET /bookings/mine` sont les deux seules sources
 * de données de plateforme accessibles avec un jeton utilisateur. Aucun
 * point d'entrée global (tous les utilisateurs, toutes les réunions,
 * statistiques, journal d'activité, applications) n'existe côté serveur :
 * cette étape ne modifiant ni le backend ni la base, l'administration
 * affiche ce que ces deux sources contiennent réellement, et signale
 * explicitement ce qu'elles ne contiennent pas.
 *
 * Les deux requêtes partent en parallèle et sont indépendantes : si l'une
 * échoue, l'autre reste affichée. Une panne partielle ne doit pas vider
 * l'écran.
 */
export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);

  const load = useCallback(async (isReload: boolean) => {
    if (isReload) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const [meetingsResult, bookingsResult] = await Promise.allSettled([
      listMyMeetings(),
      listMyBookings(),
    ]);

    const failed: string[] = [];

    if (meetingsResult.status === "fulfilled") {
      setMeetings(meetingsResult.value.meetings);
    } else {
      failed.push("réunions");
    }

    if (bookingsResult.status === "fulfilled") {
      setBookings(bookingsResult.value.bookings);
    } else {
      failed.push("séances");
    }

    setFailedSources(failed);
    if (failed.length > 0) {
      setError(
        failed.length === 2
          ? "Les données n'ont pas pu être chargées."
          : `Les données « ${failed[0]} » n'ont pas pu être chargées.`
      );
    } else {
      setLastLoadedAt(Date.now());
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const reload = useCallback(() => {
    void load(true);
  }, [load]);

  const value = useMemo<DashboardDataValue>(
    () => ({
      meetings,
      bookings,
      loading,
      refreshing,
      error,
      failedSources,
      reload,
      lastLoadedAt,
    }),
    [meetings, bookings, loading, refreshing, error, failedSources, reload, lastLoadedAt]
  );

  // `user` est lu via `useAuth` par les pages, mais le provider s'assure que
  // la session est chargée avant de considérer l'écran comme prêt : sans
  // cela, la page « Utilisateurs » afficherait un tableau vide une fraction
  // de seconde avant l'arrivée du compte.
  const effectiveLoading = loading || !user;

  return (
    <DashboardDataContext.Provider value={{ ...value, loading: effectiveLoading }}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData(): DashboardDataValue {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error(
      "useDashboardData doit être utilisé dans un <DashboardDataProvider>."
    );
  }
  return context;
}
