import { useCallback, useEffect, useState } from "react";
import { useDataChannel, useLocalParticipant } from "@livekit/components-react";

export interface FloatingReaction {
  id: string;
  emoji: string;
  identity: string;
  name: string;
  x: number; // position horizontale aléatoire, 0-100%
}

interface ReactionPayload {
  type: "reaction";
  id: string;
  emoji: string;
  identity: string;
  name: string;
}

/**
 * Réactions emoji éphémères façon Google Meet — diffusées à tout le monde
 * via le canal de données LiveKit (topic "reactions"). Pas de persistance,
 * contrairement au chat : chaque réaction s'auto-nettoie après ~3s.
 */
export function useReactions() {
  const { send, message } = useDataChannel("reactions");
  const { localParticipant } = useLocalParticipant();
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  useEffect(() => {
    if (!message?.payload) return;
    try {
      const text = new TextDecoder().decode(message.payload);
      const data = JSON.parse(text) as ReactionPayload;
      if (data.type !== "reaction") return;
      const reaction: FloatingReaction = {
        id: data.id,
        emoji: data.emoji,
        identity: data.identity,
        name: data.name,
        x: 15 + Math.random() * 70,
      };
      setReactions((prev) => [...prev, reaction]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 3000);
    } catch {
      // ignore
    }
  }, [message]);

  const sendReaction = useCallback(
    (emoji: string) => {
      const payload: ReactionPayload = {
        type: "reaction",
        id: `${localParticipant?.identity ?? "anon"}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`,
        emoji,
        identity: localParticipant?.identity || "",
        name: localParticipant?.name || localParticipant?.identity || "Anonyme",
      };
      send(new TextEncoder().encode(JSON.stringify(payload)), { reliable: true });
    },
    [localParticipant, send]
  );

  return { reactions, sendReaction };
}