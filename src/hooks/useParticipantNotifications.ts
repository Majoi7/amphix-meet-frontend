import { useEffect, useRef } from "react";
import type { Participant } from "livekit-client";
import { useParticipants, useLocalParticipant } from "@livekit/components-react";
import { useToast } from "../components/ToastProvider";

/**
 * Compare la liste des participants entre deux rendus pour détecter les
 * arrivées, et pousse une notification discrète pour chacune.
 *
 * Deux garde-fous importants :
 * 1. On attend que NOTRE PROPRE identité apparaisse dans la liste avant
 *    de fixer la référence de départ. useParticipants() peut renvoyer une
 *    liste vide/partielle le temps que la connexion LiveKit se stabilise
 *    — si on prenait cette liste incomplète comme référence, le rendu
 *    suivant (une fois la vraie liste reçue) ferait passer TOUT le monde,
 *    nous y compris, pour "nouveau".
 * 2. On exclut explicitement notre propre identité des notifications,
 *    en plus du point 1, par sécurité.
 */
export function useParticipantNotifications(): void {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { pushToast } = useToast();
  const previousParticipants = useRef<Map<string, string> | null>(null);
  const hasBaseline = useRef(false);

  useEffect(() => {
    const currentParticipants = new Map(
      participants.map((p) => [p.identity, displayName(p)])
    );

    const myIdentity = localParticipant?.identity;

    // Connexion pas encore stabilisée — on attend le rendu où on se voit
    // nous-même dans la liste avant de fixer quoi que ce soit.
    if (!myIdentity || !currentParticipants.has(myIdentity)) {
      return;
    }

    if (!hasBaseline.current) {
      previousParticipants.current = currentParticipants;
      hasBaseline.current = true;
      return;
    }

    const previous = previousParticipants.current!;

    for (const [identity, name] of currentParticipants) {
      if (identity === myIdentity) continue; // jamais de notif pour soi-même
      if (!previous.has(identity)) {
        pushToast(`${name} a rejoint la réunion`);
      }
    }

    previousParticipants.current = currentParticipants;
  }, [participants, localParticipant, pushToast]);
}

function displayName(participant: Participant): string {
  return participant.name || participant.identity;
}