import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { useLocalParticipant } from "@livekit/components-react";
import { useMeetingChat } from "../hooks/useMeetingChat";
import { getAvatarColor } from "../lib/avatarColor";

interface ChatPanelProps {
  roomId: string;
  onClose: () => void;
}

export function ChatPanel({ roomId, onClose }: ChatPanelProps) {
  const { messages, send, isSending } = useMeetingChat(roomId);
  const { localParticipant } = useLocalParticipant();
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const localIdentity = localParticipant?.identity ?? "";

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;
    send(text);
    setDraft("");
  }

  const grouped = groupByDate(messages);

  return (
    <aside className="fixed inset-x-0 top-0 bottom-16 z-40 flex h-auto w-full flex-col bg-[#0f0f0f] sm:static sm:bottom-auto sm:z-auto sm:h-full sm:w-80">
      {/* Header */}
      <div className="flex h-[52px] flex-shrink-0 items-center justify-between border-b border-white/5 px-4">
        <h2 className="text-sm font-semibold text-white">Messages</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="rounded-full p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
              <MessageIcon />
            </div>
            <p className="text-sm text-white/40">Aucun message pour l'instant</p>
            <p className="mt-1 text-xs text-white/25">
              Les messages restent visibles jusqu'à la fin de la réunion
            </p>
          </div>
        )}

        {grouped.map((group, gi) => (
          <div key={gi} className="mb-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/5" />
              <span className="text-[11px] font-medium text-white/30">
                {group.label}
              </span>
              <div className="h-px flex-1 bg-white/5" />
            </div>

            <div className="flex flex-col gap-3">
              {group.messages.map((msg) => {
                const isMe = msg.from?.identity === localIdentity;
                const name = msg.from?.name || msg.from?.identity || "Anonyme";
                const initials = name.trim().slice(0, 1).toUpperCase() || "?";
                const color = getAvatarColor(msg.from?.identity || "anon");
                const time = new Date(msg.timestamp).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <div
                      className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-black"
                      style={{ backgroundColor: color }}
                    >
                      {initials}
                    </div>

                    <div
                      className={`flex max-w-[78%] flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div className={`flex items-baseline gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                        <span className={`text-xs font-semibold ${isMe ? "text-[#8ab4f8]" : "text-white/50"}`}>
                          {isMe ? "Moi" : name}
                        </span>
                        <span className="text-[10px] text-white/25">{time}</span>
                      </div>

                      <div
                        className={`mt-0.5 px-3 py-2 text-[13px] leading-relaxed ${
                          isMe
                            ? "rounded-2xl rounded-tr-sm bg-[#174ea6] text-white"
                            : "rounded-2xl rounded-tl-sm border border-white/5 bg-[#1a1a1a] text-white/90"
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex-shrink-0 border-t border-white/5 px-4 pb-4 pt-3"
      >
        <div className="flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-4 py-1 transition-colors focus-within:border-white/10">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Envoyer un message..."
            maxLength={500}
            className="flex-1 bg-transparent py-2.5 text-[13px] text-white placeholder:text-white/25 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || isSending}
            aria-label="Envoyer"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#8ab4f8] text-black transition-all hover:bg-[#aecbfa] disabled:bg-white/5 disabled:text-white/20"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function groupByDate(messages: Array<any>) {
  const groups: { label: string; messages: typeof messages }[] = [];
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let current: (typeof groups)[0] | null = null;

  messages.forEach((msg) => {
    const d = new Date(msg.timestamp);
    const label = isSameDay(d, today)
      ? "Aujourd'hui"
      : isSameDay(d, yesterday)
      ? "Hier"
      : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

    if (!current || current.label !== label) {
      current = { label, messages: [] };
      groups.push(current);
    }
    current.messages.push(msg);
  });

  return groups;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function MessageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}