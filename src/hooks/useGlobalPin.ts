import { useState, useEffect } from "react";
import { useDataChannel } from "@livekit/components-react";
import { authorizedRequest } from "../lib/httpClient";

interface GlobalPinState {
  participantId: string | null;
  trackSource: "Camera" | "ScreenShare" | null;
}

const EMPTY: GlobalPinState = { participantId: null, trackSource: null };

function normalizeTrackSource(value: unknown): "Camera" | "ScreenShare" | null {
  return value === "Camera" || value === "ScreenShare" ? value : null;
}

/**
 * État de l'épingle globale de la réunion.
 *
 * Deux sources complémentaires :
 *  1. un GET au montage — permet de retrouver l'épingle après un
 *     rechargement de page (le backend la persiste en base) ;
 *  2. le data channel LiveKit `global-pin` — propage les changements en
 *     temps réel à tous les participants déjà connectés.
 *
 * Le message LiveKit arrive sous forme d'un objet `{ payload: Uint8Array,
 * topic, from }`. Il faut donc DÉCODER `payload` avant de le parser — lire
 * directement `message.participantId` renvoie toujours `undefined`, et
 * l'erreur est silencieuse puisqu'aucune exception n'est levée.
 */
export function useGlobalPin(roomId: string): GlobalPinState {
  const [globalPin, setGlobalPin] = useState<GlobalPinState>(EMPTY);

  const { message } = useDataChannel("global-pin");

  // 1. Restauration après rechargement.
  useEffect(() => {
    if (!roomId) {
      setGlobalPin(EMPTY);
      return;
    }

    let cancelled = false;

    const fetchInitialState = async () => {
      try {
        const data = await authorizedRequest<{ meeting: Record<string, unknown> }>(
          `/api/v1/meetings/${roomId}`
        );
        if (cancelled) return;

        const meeting = data?.meeting ?? {};
        setGlobalPin({
          participantId: (meeting.globalPinnedParticipantId as string | null) ?? null,
          trackSource: normalizeTrackSource(meeting.globalPinnedTrackSource),
        });
      } catch (err) {
        // Pas bloquant : la réunion doit rester utilisable même si l'épingle
        // globale ne peut pas être restaurée.
        console.error("Failed to fetch initial global pin state:", err);
      }
    };

    void fetchInitialState();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // 2. Mises à jour temps réel.
  useEffect(() => {
    if (!message?.payload) return;
    try {
      const text = new TextDecoder().decode(message.payload);
      const data = JSON.parse(text) as {
        participantId?: string | null;
        trackSource?: string | null;
      };
      setGlobalPin({
        participantId: data.participantId ?? null,
        trackSource: normalizeTrackSource(data.trackSource),
      });
    } catch (err) {
      console.error("Invalid global pin message:", err);
    }
  }, [message]);

  return globalPin;
}
