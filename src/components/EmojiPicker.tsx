interface EmojiPickerProps {
  isHandRaised: boolean;
  onToggleHand: () => void;
  onSendReaction: (emoji: string) => void;
  className?: string;
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "👏", "🎉"];

/** Reste ouvert tant que le bouton parent n'est pas retapé — pas de
 * fermeture automatique au choix d'un emoji ni au clic ailleurs. */
export function EmojiPicker({
  isHandRaised,
  onToggleHand,
  onSendReaction,
  className = "",
}: EmojiPickerProps) {
  return (
    <div
      className={`flex items-center gap-1 rounded-full bg-[#1a1a1a] p-1.5 shadow-2xl ring-1 ring-white/10 ${className}`}
    >
      <button
        type="button"
        onClick={onToggleHand}
        aria-label="Lever/baisser la main"
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-lg transition-colors ${
          isHandRaised ? "bg-yellow-500/20" : "hover:bg-white/10"
        }`}
      >
        ✋
      </button>
      <div className="mx-0.5 h-6 w-px flex-shrink-0 bg-white/10" />
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSendReaction(emoji)}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-lg transition-transform hover:scale-125 active:scale-95 hover:bg-white/10"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}