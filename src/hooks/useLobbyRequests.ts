import { useCallback, useEffect, useRef, useState } from "react";
import { listLobbyRequests, type LobbyRequestItem } from "../lib/meetingApi";
import { useToast } from "../components/ToastProvider";

const POLL_INTERVAL_MS = 4000;

/**
 * Poll les demandes de salle d'attente en attente, uniquement si
 * isHost=true (sinon aucune requête n'est faite). Notifie par toast
 * chaque NOUVELLE demande (compare avec les ids déjà vus, pas juste la
 * longueur — pour ne jamais re-notifier une demande déjà connue).
 */
export function useLobbyRequests(joinCode: string, isHost: boolean) {
  const [requests, setRequests] = useState<LobbyRequestItem[]>([]);
  const { pushToast } = useToast();
  const knownIdsRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!isHost) return;
    try {
      const res = await listLobbyRequests(joinCode);
      const newOnes = res.requests.filter((r) => !knownIdsRef.current.has(r.id));
      newOnes.forEach((r) => pushToast(`${r.name} souhaite rejoindre la réunion.`));
      knownIdsRef.current = new Set(res.requests.map((r) => r.id));
      setRequests(res.requests);
    } catch {
      /* silencieux — le prochain poll réessaiera */
    }
  }, [joinCode, isHost, pushToast]);

  useEffect(() => {
    if (!isHost) return;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh, isHost]);

  return { requests, refresh };
}
