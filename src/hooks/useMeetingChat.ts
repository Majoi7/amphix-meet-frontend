// src/hooks/useMeetingChat.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { useChat, useLocalParticipant } from "@livekit/components-react";

interface ChatMessage {
  id: string;
  from?: {
    identity: string;
    name?: string;
  };
  message: string;
  timestamp: number;
}

const STORAGE_KEY = (roomId: string) => `amphix-chat-${roomId}`;

export function useMeetingChat(roomId: string) {
  const { chatMessages, send, isSending } = useChat();
  const { localParticipant } = useLocalParticipant();

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY(roomId));
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
    return [];
  });

  const processedIds = useRef(new Set<string>());
  const syncState = useRef<"idle" | "requested" | "received">("idle");

  useEffect(() => {
    messages.forEach((m) => {
      if (m.id) processedIds.current.add(m.id);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY(roomId), JSON.stringify(messages));
  }, [messages, roomId]);

  useEffect(() => {
    const newMessages = chatMessages.filter(
      (m) => m.id && !processedIds.current.has(m.id)
    );
    if (newMessages.length === 0) return;

    newMessages.forEach((m) => {
      if (m.id) processedIds.current.add(m.id);
    });

    const normalMessages: ChatMessage[] = [];

    newMessages.forEach((msg: any) => {
      const text: string = msg.message ?? "";
      if (text.startsWith("__SYNC__")) {
        handleSyncMessage(msg as ChatMessage);
      } else {
        normalMessages.push(msg as ChatMessage);
      }
    });

    if (normalMessages.length > 0) {
      setMessages((prev) => {
        const merged = [...prev, ...normalMessages];
        merged.sort((a, b) => a.timestamp - b.timestamp);
        return merged;
      });
    }
  }, [chatMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!localParticipant || syncState.current !== "idle") return;
    const timer = setTimeout(() => {
      syncState.current = "requested";
      send("__SYNC__REQUEST__");
    }, 1500);
    return () => clearTimeout(timer);
  }, [localParticipant, send]);

  const handleSyncMessage = useCallback(
    (msg: ChatMessage) => {
      if (!localParticipant) return;
      const fromOthers = msg.from?.identity !== localParticipant.identity;

      if (msg.message === "__SYNC__REQUEST__" && fromOthers) {
        const jitter = Math.random() * 600;
        setTimeout(() => {
          const payload = JSON.stringify({
            type: "HISTORY",
            messages: messages,
          });
          send(`__SYNC__${payload}`);
        }, 200 + jitter);
        return;
      }

      if (msg.message.startsWith("__SYNC__") && fromOthers) {
        try {
          const json = JSON.parse(msg.message.replace("__SYNC__", ""));
          if (json.type === "HISTORY" && Array.isArray(json.messages)) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const merged = [...prev];
              json.messages.forEach((m: ChatMessage) => {
                if (m.id && !existingIds.has(m.id)) {
                  merged.push(m);
                  processedIds.current.add(m.id);
                }
              });
              merged.sort((a, b) => a.timestamp - b.timestamp);
              return merged;
            });
            syncState.current = "received";
          }
        } catch {
          // ignore
        }
      }
    },
    [localParticipant, messages, send]
  );

  const sendMessage = useCallback(
    (text: string) => {
      if (text.trim()) send(text);
    },
    [send]
  );

  return { messages, send: sendMessage, isSending };
}