import type { FloatingReaction } from "../hooks/useReactions";

interface ReactionOverlayProps {
  reactions: FloatingReaction[];
}

/** Bulles emoji qui montent et s'estompent, façon Google Meet. */
export function ReactionOverlay({ reactions }: ReactionOverlayProps) {
  if (reactions.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      <style>{`
        @keyframes reaction-float {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          10% { transform: translateY(-10px) scale(1); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(-70vh) scale(1.1); opacity: 0; }
        }
      `}</style>
      {reactions.map((r) => (
        <span
          key={r.id}
          className="absolute bottom-24 text-4xl drop-shadow-lg"
          style={{ left: `${r.x}%`, animation: "reaction-float 3s ease-out forwards" }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}