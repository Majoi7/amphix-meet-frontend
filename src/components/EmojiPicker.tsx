import { useState } from "react";

interface EmojiPickerProps {
  onSendReaction: (emoji: string) => void;
  className?: string;
}

const REACTION_EMOJIS = [
  { emoji: "👍", label: "Pouce levé" },
  { emoji: "❤️", label: "Cœur" },
  { emoji: "😂", label: "Rire" },
  { emoji: "😮", label: "Surprise" },
  { emoji: "👏", label: "Applaudissements" },
  { emoji: "🎉", label: "Célébration" },
];

/**
 * Reste ouvert tant que le bouton parent n'est pas retapé — pas de
 * fermeture automatique au choix d'un emoji ni au clic ailleurs.
 * Le bouton "lever la main" est sorti de ce composant : c'est maintenant
 * un bouton principal à part entière dans MeetControls.
 */
export function EmojiPicker({ onSendReaction, className = "" }: EmojiPickerProps) {
  const [justSent, setJustSent] = useState<string | null>(null);

  function handleSendReaction(emoji: string) {
    onSendReaction(emoji);
    setJustSent(emoji);
    window.setTimeout(() => setJustSent((current) => (current === emoji ? null : current)), 300);
  }

  return (
    <div
      className={`flex items-center gap-1 rounded-full bg-[#1a1a1a] p-1.5 shadow-2xl ring-1 ring-white/10 ${className}`}
    >
      {REACTION_EMOJIS.map(({ emoji, label }) => (
        <button
          key={emoji}
          type="button"
          onClick={() => handleSendReaction(emoji)}
          aria-label={label}
          title={label}
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-2xl leading-none transition-transform duration-150 hover:scale-125 hover:bg-white/10 active:scale-90 ${
            justSent === emoji ? "scale-150" : ""
          }`}
        >
          <span className="block">{emoji}</span>
        </button>
      ))}
    </div>
  );
}