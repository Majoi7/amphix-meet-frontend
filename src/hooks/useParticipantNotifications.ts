import { useEffect, useRef } from "react";
import type { Participant } from "livekit-client";
import { useParticipants } from "@livekit/components-react";
import { useToast } from "../components/ToastProvider";

/**
 * Compare la liste des participants entre deux rendus pour détecter les
 * arrivées et départs, et pousse une notification discrète pour chacun.
 * Ignore le tout premier rendu (sinon on notifierait pour tout le monde
 * déjà présent au moment où on rejoint).
 */
export function useParticipantNotifications(): void {
  const participants = useParticipants();
  const { pushToast } = useToast();
  const previousParticipants = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    const currentParticipants = new Map(
      participants.map((p) => [p.identity, displayName(p)])
    );

    if (previousParticipants.current === null) {
      previousParticipants.current = currentParticipants;
      return;
    }

    const previous = previousParticipants.current;

    for (const [identity, name] of currentParticipants) {
      if (!previous.has(identity)) {
        pushToast(`${name} a rejoint la réunion`);
      }
    }

    for (const [identity, name] of previous) {
      if (!currentParticipants.has(identity)) {
        pushToast(`${name} a quitté la réunion`);
      }
    }

    previousParticipants.current = currentParticipants;
  }, [participants, pushToast]);
}

function displayName(participant: Participant): string {
  return participant.name || participant.identity;
}
