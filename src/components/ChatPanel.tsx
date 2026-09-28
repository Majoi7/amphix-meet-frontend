import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Send, X } from "lucide-react";
import { useLocalParticipant, useParticipants } from "@livekit/components-react";
import { useMeetingChat } from "../hooks/useMeetingChat";
import { useElementSize } from "../hooks/useElementSize";
import { resolveAvatar } from "../lib/avatarColor";

interface ChatPanelProps {
  roomId: string;
  onClose: () => void;
}

export function ChatPanel({ roomId, onClose }: ChatPanelProps) {
  const { messages, send, isSending } = useMeetingChat(roomId);
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [draft, setDraft] = useState("");

  /**
   * Le metadata du participant, indexé par identité.
   *
   * Un message ne transporte que `from.identity` et `from.name` — pas le
   * metadata. Sans cette table, le chat ne pouvait pas afficher la photo et
   * retombait systématiquement sur les initiales, alors que la tuile du même
   * participant affichait sa photo. Un expéditeur déjà parti n'est plus dans
   * la table : il retombe proprement sur ses initiales.
   */
  const metadataByIdentity = useMemo(() => {
    const map = new Map<string, string>();
    // `Participant.metadata` est optionnel : on normalise en chaîne vide plutôt
    // que de transporter `undefined`, pour que la valeur lue soit toujours du
    // type attendu par `resolveAvatar`.
    participants.forEach((participant) =>
      map.set(participant.identity, participant.metadata ?? "")
    );
    return map;
  }, [participants]);
  /**
   * Le conteneur de messages est mesuré par le hook de mesure du projet.
   *
   * Sa hauteur change à la ROTATION et à l'OUVERTURE DU CLAVIER virtuel — le
   * `viewport-fit` / `interactive-widget` de `index.html` fait réellement
   * rétrécir la surface. Sans cette mesure, la liste restait calée sur
   * l'ancienne hauteur et le dernier message passait sous le clavier.
   */
  const { ref: listRef, size: listSize } = useElementSize<HTMLDivElement>();

  /**
   * L'utilisateur est-il « collé » en bas de la liste ?
   *
   * Ce drapeau est mis à jour par le DÉFILEMENT, pas au moment d'insérer un
   * message. C'est indispensable : mesurer la distance au bas APRÈS l'insertion
   * compte déjà la hauteur du nouveau message. Un message de plus de 100 px
   * faisait donc passer la liste pour « non collée en bas », et le défilement
   * ne descendait plus — le bug constaté.
   */
  const stickToBottomRef = useRef(true);
  /**
   * Même information, mais RÉACTIVE.
   *
   * Le drapeau ci-dessus est une `ref` : il pilote le défilement sans
   * provoquer de rendu, ce qui est voulu. Mais il ne peut pas décider de
   * l'affichage du bouton « revenir au dernier message », qui doit apparaître
   * et disparaître. D'où ce second état, tenu à jour au même endroit — une
   * seule condition, deux usages, jamais de divergence possible.
   */
  const [atBottom, setAtBottom] = useState(true);

  const localIdentity = localParticipant?.identity ?? "";

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    const next = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickToBottomRef.current = next;
    setAtBottom(next);
  }

  function scrollToLatest() {
    const el = listRef.current;
    stickToBottomRef.current = true;
    setAtBottom(true);
    if (el) el.scrollTop = el.scrollHeight;
  }

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (!stickToBottomRef.current) return;
    // Défilement instantané, et non `smooth` : une animation en cours fait
    // remonter `scrollTop`, ce qui ferait croire à tort que l'utilisateur a
    // remonté la liste et couperait l'auto-défilement des messages suivants.
    el.scrollTop = el.scrollHeight;
  }, [messages.length, listRef]);

  /**
   * Recaler la liste quand sa HAUTEUR change, et non seulement quand un
   * message arrive.
   *
   * C'est le cas de la rotation et du clavier virtuel : la surface rétrécit,
   * `scrollTop` ne bouge pas, et le dernier message sort de la vue alors que
   * l'utilisateur n'a rien fait. S'il lisait l'historique, en revanche, on ne
   * touche à rien : son défilement lui appartient.
   */
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (!stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [listSize.height, listRef]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;
    send(text);
    setDraft("");
  }

  const grouped = groupByDate(messages);

  // Mobile : plein écran SOUS le header, comme le panneau Participants — les
  // deux panneaux doivent se comporter pareil. En desktop le panneau est dans
  // le flux (`sm:static`) et `top` est ignoré.
  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-[#0f0f0f] sm:w-80">
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

      {/* Messages.

          La liste est enveloppée dans un repère qui, lui, NE défile pas :
          c'est ce qui permet au bouton « revenir au dernier message » de
          rester posé au-dessus de la liste au lieu de défiler avec elle. */}
      <div className="relative min-h-0 flex-1">
        <div ref={listRef} onScroll={handleScroll} className="h-full overflow-y-auto px-4 py-4">
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
                const senderIdentity = msg.from?.identity || "anon";
                const time = new Date(msg.timestamp).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <ChatAvatar
                      identity={senderIdentity}
                      name={msg.from?.name}
                      metadata={metadataByIdentity.get(senderIdentity)}
                    />

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
                        className={`mt-0.5 px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
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

        {/* Revenir au dernier message — n'apparaît que si l'utilisateur a
            remonté l'historique. C'est le pendant du défilement automatique :
            on ne lui vole jamais son défilement, mais on lui rend le retour
            possible en un geste. */}
        {!atBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={scrollToLatest}
            aria-label="Revenir aux derniers messages"
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#2a2a2a] px-3 py-1.5 text-[11px] font-medium text-white shadow-lg ring-1 ring-white/10 transition-colors hover:bg-[#333]"
          >
            <ArrowDown size={13} />
            Derniers messages
          </button>
        )}
        </div>
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

/**
 * Avatar d'un message.
 *
 * Composant à part, et non un simple bloc dans la boucle d'affichage : il lui
 * faut un état local pour retenir la photo dont le chargement a échoué, et un
 * hook ne peut pas être appelé à l'intérieur d'un `.map()`.
 */
function ChatAvatar({
  identity,
  name,
  metadata,
}: {
  identity: string;
  name?: string;
  metadata?: string;
}) {
  const avatar = resolveAvatar({ identity, name, metadata });
  const [brokenPhotoUrl, setBrokenPhotoUrl] = useState<string | null>(null);
  const photoUrl =
    avatar.photoUrl && avatar.photoUrl !== brokenPhotoUrl ? avatar.photoUrl : null;

  return (
    <div
      className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold text-black"
      style={{ backgroundColor: avatar.color }}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          onError={() => setBrokenPhotoUrl(photoUrl)}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        avatar.initials
      )}
    </div>
  );
}

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