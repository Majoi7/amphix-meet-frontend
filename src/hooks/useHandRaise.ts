import { useCallback, useEffect, useState } from "react";
import { useDataChannel, useLocalParticipant } from "@livekit/components-react";

interface HandPayload {
  type: "hand";
  identity: string;
  name: string;
  raised: boolean;
}

export function useHandRaise() {
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
      }
    } catch {
      // ignore
    }
  }, [message, localParticipant]);

  const toggleHand = useCallback(() => {
    const next = !isHandRaised;
    setIsHandRaised(next);
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