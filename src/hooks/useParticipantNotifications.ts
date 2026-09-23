import { useEffect, useRef } from "react";
import type { Participant } from "livekit-client";
import { useParticipants, useLocalParticipant } from "@livekit/components-react";
import { useToast } from "../components/ToastProvider";
import { playSound, preloadSound, SOUND_ENTREE } from "../lib/sounds";

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
 * 2. La référence est mise à jour à CHAQUE rendu, après traitement. Un simple
 *    changement de disposition, de caméra ou d'état « muet » ne modifie pas
 *    la liste des identités : aucun son n'est donc déclenché par autre chose
 *    qu'une entrée réelle.
 *
 * 3. Un identifiant déjà annoncé est mémorisé jusqu'à ce qu'il quitte la
 *    réunion. Une même arrivée ne peut donc pas produire deux sons, même si
 *    React rejoue l'effet.
 *
 * 4. La référence de départ n'est fixée qu'une fois : le chargement initial
 *    complet de la réunion ne déclenche aucun son.
 *
 * SON D'ENTRÉE — tout le monde l'entend
 *
 * Les participants DÉJÀ présents détectent l'arrivant par différence avec la
 * référence précédente. Le participant qui ARRIVE, lui, n'a personne pour le
 * lui signaler : il entend son propre son au moment où il établit sa
 * référence de départ, et seulement si la réunion était déjà en cours
 * (`size > 1`). Celui qui ouvre une réunion vide n'entend donc rien.
 *
 * SON DE SORTIE — réservé à celui qui part
 *
 * Il n'est PAS joué ici. La règle est que seul l'utilisateur qui quitte
 * volontairement la réunion l'entend ; les autres ne doivent rien entendre.
 * Un écouteur de la composition de la réunion ne peut pas respecter cette
 * règle : il s'exécute chez TOUT LE MONDE. Le son est donc joué localement,
 * dans `RoomPage`, au moment où l'utilisateur déclenche lui-même son départ.
 * Ce hook se contente de libérer l'identifiant, pour qu'une ré-arrivée
 * ultérieure du même participant soit annoncée à nouveau.
 */
export function useParticipantNotifications(): void {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { pushToast } = useToast();
  const previousParticipants = useRef<Map<string, string> | null>(null);
  const hasBaseline = useRef(false);
  /** Identités présentes à la dernière analyse — anti-rejeu, indépendant du cycle de rendu. */
  const announced = useRef<Set<string>>(new Set());

  // Préchargement : le premier arrivant ne doit pas attendre le réseau.
  useEffect(() => {
    preloadSound(SOUND_ENTREE);
  }, []);

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
      announced.current = new Set(currentParticipants.keys());
      hasBaseline.current = true;

      // Notre propre son d'entrée. `size > 1` signifie que d'autres
      // participants étaient déjà là : la réunion était en cours. Si on est
      // seul, on vient d'ouvrir la réunion — aucun son.
      if (currentParticipants.size > 1) {
        playSound(SOUND_ENTREE);
      }
      return;
    }

    const previous = previousParticipants.current!;

    /* --- Arrivées ------------------------------------------------- */
    for (const [identity, name] of currentParticipants) {
      if (identity === myIdentity) continue; // déjà annoncée ci-dessus
      if (previous.has(identity)) continue;

      pushToast(`${name} a rejoint la réunion`);
      if (!announced.current.has(identity)) {
        announced.current.add(identity);
        playSound(SOUND_ENTREE);
      }
    }

    /* --- Départs -------------------------------------------------- */
    // Aucun son, aucune notification : le son de sortie appartient à celui
    // qui part, et il est joué chez lui. On libère simplement l'identifiant
    // pour qu'une ré-arrivée ultérieure soit annoncée à nouveau.
    for (const identity of previous.keys()) {
      if (currentParticipants.has(identity)) continue;
      announced.current.delete(identity);
    }

    previousParticipants.current = currentParticipants;
  }, [participants, localParticipant, pushToast]);
}

function displayName(participant: Participant): string {
  return participant.name || participant.identity;
}
