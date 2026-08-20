import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { useChat } from "@livekit/components-react";

interface ChatPanelProps {
  onClose: () => void;
}

/**
 * Chat textuel de la réunion, basé sur le canal de données LiveKit
 * (pas besoin de backend séparé — les messages transitent en temps réel
 * entre participants via la salle LiveKit elle-même).
 */
export function ChatPanel({ onClose }: ChatPanelProps) {
  const { chatMessages, send, isSending } = useChat();
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;
    send(text);
    setDraft("");
  }

  return (
    <aside className="fixed inset-x-0 top-0 bottom-16 z-40 flex h-auto w-full flex-col border-l border-meet-border bg-meet-bg-secondary sm:static sm:bottom-auto sm:z-auto sm:h-full sm:w-80">      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-meet-border px-4">
        <h2 className="text-sm font-medium">Messages</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le chat"
          className="rounded p-1.5 text-meet-text-secondary hover:bg-meet-control"
        >
          <X size={18} />
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {chatMessages.length === 0 && (
          <p className="mt-6 text-center text-sm text-meet-text-secondary">
            Aucun message pour l'instant. Les messages ne sont visibles que par
            les personnes présentes dans la réunion.
          </p>
        )}

        {chatMessages.map((msg) => (
          <div key={msg.id} className="animate-fade-in text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-meet-blue">
                {msg.from?.name || msg.from?.identity || "Anonyme"}
              </span>
              <span className="text-xs text-meet-text-disabled">
                {new Date(msg.timestamp).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="mt-0.5 break-words text-meet-text-primary">{msg.message}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-meet-border p-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Envoyer un message…"
          maxLength={500}
          className="flex-1 rounded-full bg-meet-control px-4 py-2 text-sm text-meet-text-primary placeholder:text-meet-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-meet-blue"
        />
        <button
          type="submit"
          disabled={!draft.trim() || isSending}
          aria-label="Envoyer le message"
          className="control-btn h-10 w-10 bg-meet-blue text-meet-bg hover:bg-meet-blue-hover disabled:bg-meet-control disabled:text-meet-text-disabled"
        >
          <Send size={16} />
        </button>
      </form>
    </aside>
  );
}
