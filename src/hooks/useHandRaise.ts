import { useCallback, useEffect, useState } from "react";
import { useDataChannel, useLocalParticipant } from "@livekit/components-react";
import { playSound, SOUND_HAND_RAISE } from "../lib/sounds";

export interface HandPayload {
  type: "hand";
  identity: string;
  name: string;
  raised: boolean;
}

export function useHandRaise(onHandRaise?: (payload: HandPayload) => void) {
  const { send, message } = useDataChannel("hand-raise");
  const { localParticipant } = useLocalParticipant();
  const [raisedHands, setRaisedHands] = useState<Map<string, string>>(new Map());
  const [isHandRaised, setIsHandRaised] = useState(false);

  useEffect(() => {
    if (!message?.payload) return;
    try {
      const text = new TextDecoder().decode(message.payload);
      const data = JSON.parse(text) as HandPayload;
      if (data.type === "hand") {
        setRaisedHands((prev) => {
          const next = new Map(prev);
          if (data.raised) next.set(data.identity, data.name || data.identity);
          else next.delete(data.identity);
          return next;
        });
        if (data.identity === localParticipant?.identity) {
          setIsHandRaised(data.raised);
        }
        if (onHandRaise && data.raised) {
          onHandRaise(data);
        }
      }
    } catch {
      // ignore
    }
  }, [message, localParticipant, onHandRaise]);

  const toggleHand = useCallback(() => {
    const next = !isHandRaised;
    setIsHandRaised(next);

    // Le son est joué ICI, chez celui qui lève la main.
    //
    // LiveKit ne renvoie pas l'écho de nos propres messages : le `message` de
    // `useDataChannel` ne se déclenche que pour les messages venus d'un AUTRE
    // participant. Sans ce déclenchement local, celui qui lève la main serait
    // le seul à ne rien entendre. Les autres le reçoivent par le canal de
    // données et le jouent dans `handleHandRaise` (Room.tsx) : chaque
    // participant joue le son une fois, jamais deux.
    if (next) playSound(SOUND_HAND_RAISE);

    const payload: HandPayload = {
      type: "hand",
      identity: localParticipant?.identity || "",
      name: localParticipant?.name || localParticipant?.identity || "Anonyme",
      raised: next,
    };
    send(
      new TextEncoder().encode(JSON.stringify(payload)),
      { reliable: true }
    );
  }, [isHandRaised, localParticipant, send]);

  return { raisedHands, isHandRaised, toggleHand };
}