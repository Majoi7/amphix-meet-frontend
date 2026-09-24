import { useCallback, useEffect, useRef } from "react";
import { ConnectionState, type Participant } from "livekit-client";
import {
  useParticipants,
  useLocalParticipant,
  useConnectionState,
  useDataChannel,
} from "@livekit/components-react";
import { useToast } from "../components/ToastProvider";
import {
  playSound,
  preloadSound,
  SOUND_ENTREE,
  SOUND_SORTIE,
} from "../lib/sounds";

/**
 * Canal de données qui transporte l'annonce de DÉPART VOLONTAIRE.
 *
 * Un simple écart dans la liste des participants ne dit pas POURQUOI
 * quelqu'un a disparu : un clic sur « Quitter », une fermeture d'onglet et
 * une coupure réseau produisent exactement la même disparition. Le son de
 * sortie ne devant être joué que pour un départ volontaire, c'est celui qui
 * part qui l'annonce lui-même, juste avant de fermer sa connexion.
 */
export const PRESENCE_TOPIC = "presence";

interface PresencePayload {
  type: "leave";
  identity: string;
}

/**
 * Émet l'annonce de départ volontaire.
 *
 * À appeler AVANT la déconnexion : une fois la connexion fermée, le message
 * ne partirait plus. La promesse résolue signifie que le paquet a été remis
 * au moteur LiveKit — les autres participants le recevront donc même si la
 * fermeture de la connexion suit immédiatement.
 */
export function useLeaveAnnouncement(): () => Promise<void> {
  const { send } = useDataChannel(PRESENCE_TOPIC);
  const { localParticipant } = useLocalParticipant();

  return useCallback(async () => {
    const identity = localParticipant?.identity;
    if (!identity) return;

    const payload: PresencePayload = { type: "leave", identity };
    try {
      await send(new TextEncoder().encode(JSON.stringify(payload)), {
        reliable: true,
      });
    } catch {
      // L'annonce ne doit jamais empêcher de quitter la réunion.
    }
  }, [send, localParticipant]);
}

/**
 * Suit la composition de la réunion et réagit aux VRAIES arrivées.
 *
 * C'est l'unique système branché sur `useParticipants()` : un second écouteur
 * sur le même événement produirait des sons en double.
 *
 * QUATRE GARDE-FOUS
 *
 * 1. On attend que NOTRE PROPRE identité apparaisse dans la liste avant de
 *    fixer la référence de départ. `useParticipants()` peut renvoyer une
 *    liste vide/partielle le temps que la connexion LiveKit se stabilise —
 *    si on prenait cette liste incomplète comme référence, le rendu suivant
 *    ferait passer TOUT le monde, nous y compris, pour « nouveau ».
 *
 * 2. La référence n'est fixée qu'une fois la salle `connected`. LiveKit
 *    n'applique la réponse de jointure — qui contient tous les participants
 *    déjà présents — qu'à ce moment-là. Sans ce verrou, celui qui rejoint
 *    une réunion déjà peuplée verrait les occupants arriver « après » lui et
 *    entendrait son propre son d'entrée deux fois.
 *
 * 3. Un identifiant déjà annoncé est mémorisé jusqu'à ce qu'il quitte la
 *    réunion. Une même arrivée ne peut donc pas produire deux sons, même si
 *    React rejoue l'effet (StrictMode).
 *
 * 4. La référence de départ n'est fixée qu'une fois : le chargement initial
 *    complet de la réunion ne déclenche aucun son parasite.
 *
 * SON D'ENTRÉE — tout le monde l'entend
 *
 * Les participants DÉJÀ présents détectent l'arrivant par différence avec la
 * référence précédente. Le participant qui ARRIVE, lui, n'a personne pour le
 * lui signaler : il entend donc son propre son à l'instant où sa référence
 * de départ est fixée, QU'IL SOIT SEUL OU NON — celui qui ouvre une réunion
 * vide doit lui aussi savoir qu'il est entré.
 *
 * SON DE SORTIE — pour celui qui part ET pour ceux qui restent
 *
 * Il n'est PAS déclenché par la disparition d'un participant : voir le
 * commentaire du canal `presence` ci-dessus. Celui qui part le joue chez lui
 * (dans `Room.tsx`, au moment où il déclenche son départ) ; les autres le
 * jouent à la RÉCEPTION de son annonce. Une fermeture d'onglet ou une
 * coupure réseau ne produit donc aucun son, ce qui est le comportement voulu.
 */
export function useParticipantNotifications(): void {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const connectionState = useConnectionState();
  const { message: presenceMessage } = useDataChannel(PRESENCE_TOPIC);
  const { pushToast } = useToast();
  const previousParticipants = useRef<Map<string, string> | null>(null);
  const hasBaseline = useRef(false);
  /** Identités présentes à la dernière analyse — anti-rejeu, indépendant du cycle de rendu. */
  const announced = useRef<Set<string>>(new Set());
  /** Identités dont le départ volontaire a déjà été sonorisé. */
  const announcedLeaves = useRef<Set<string>>(new Set());

  // Préchargement : le premier arrivant ne doit pas attendre le réseau.
  useEffect(() => {
    preloadSound(SOUND_ENTREE);
  }, []);

  /* --- Départs volontaires, annoncés par celui qui part ---------------- */
  useEffect(() => {
    if (!presenceMessage?.payload) return;

    let payload: PresencePayload | null = null;
    try {
      payload = JSON.parse(
        new TextDecoder().decode(presenceMessage.payload)
      ) as PresencePayload;
    } catch {
      payload = null; // message illisible
    }

    if (!payload || payload.type !== "leave") return;
    if (payload.identity === localParticipant?.identity) return;
    if (announcedLeaves.current.has(payload.identity)) return;

    announcedLeaves.current.add(payload.identity);
    playSound(SOUND_SORTIE);
  }, [presenceMessage, localParticipant]);

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

    // La liste n'est fiable qu'une fois la salle `connected` (voir garde-fou 2).
    if (connectionState !== ConnectionState.Connected) {
      return;
    }

    if (!hasBaseline.current) {
      previousParticipants.current = currentParticipants;
      announced.current = new Set(currentParticipants.keys());
      hasBaseline.current = true;

      // Notre propre son d'entrée, inconditionnel : sans lui, celui qui ouvre
      // une réunion vide serait le seul à qui l'arrivée n'est jamais annoncée.
      playSound(SOUND_ENTREE);
      return;
    }

    const previous = previousParticipants.current!;

    /* --- Arrivées ------------------------------------------------- */
    for (const [identity, name] of currentParticipants) {
      if (identity === myIdentity) continue; // déjà annoncée ci-dessus
      if (previous.has(identity)) continue;

      // (Ré)arrivée : un départ annoncé précédemment est oublié, pour qu'un
      // départ ultérieur du même participant soit de nouveau sonorisé.
      announcedLeaves.current.delete(identity);

      pushToast(`${name} a rejoint la réunion`);
      if (!announced.current.has(identity)) {
        announced.current.add(identity);
        playSound(SOUND_ENTREE);
      }
    }

    /* --- Départs -------------------------------------------------- */
    // Aucun son ici. Une disparition de la liste ne dit pas si le départ
    // était volontaire : fermer son onglet ou perdre sa connexion produit la
    // même disparition. On libère simplement l'identifiant, pour qu'une
    // ré-arrivée ultérieure soit annoncée à nouveau.
    for (const identity of previous.keys()) {
      if (currentParticipants.has(identity)) continue;
      announced.current.delete(identity);
    }

    previousParticipants.current = currentParticipants;
  }, [participants, localParticipant, connectionState, pushToast]);
}

function displayName(participant: Participant): string {
  return participant.name || participant.identity;
}
