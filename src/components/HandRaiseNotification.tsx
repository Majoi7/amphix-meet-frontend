import { useEffect, useState } from "react";

interface HandRaiseNotificationProps {
  name: string;
  id: string;
  onRemove: (id: string) => void;
}

export function HandRaiseNotification({ name, id, onRemove }: HandRaiseNotificationProps) {
  const [visible, setVisible] = useState(false);
  const [animateComplete, setAnimateComplete] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setVisible(true);
    // After a short delay, trigger the bounce/scale animation
    const timeout = setTimeout(() => {
      setAnimateComplete(true);
    }, 100);
    // After total duration, remove the notification
    const removeTimeout = setTimeout(() => {
      onRemove(id);
    }, 3000); // 3 seconds total visibility
    return () => {
      clearTimeout(timeout);
      clearTimeout(removeTimeout);
    };
  }, [name, id, onRemove]);

  if (!visible) return null;

  // Pas de positionnement propre : le composant vit dans une pile
  // (`flex flex-col-reverse` dans Room). Avec un `fixed bottom-4 right-4` ici,
  // chaque notification se plaçait au même endroit du viewport et recouvrait
  // les précédentes au lieu de s'empiler.
  return (
    <div className={`pointer-events-auto flex items-center space-x-3 rounded-xl bg-black/80 p-4 text-white shadow-xl ring-1 ring-white/10 backdrop-blur-md transition-all duration-300 transform ${
      animateComplete ? "translate-y-0 scale-100 opacity-100" : "translate-y-full opacity-0"
    }`}>
      {/* Baby turtle emoji */}
      <div className="text-2xl">🐢</div>
      <div className="min-w-0">
        <p className="truncate font-medium">{name} a levé la main</p>
      </div>
      {/* Optional: close button */}
      <button
        onClick={() => onRemove(id)}
        className="ml-4 flex-shrink-0 text-sm text-white/60 transition-colors hover:text-white"
        aria-label="Fermer la notification"
      >
        ✕
      </button>
    </div>
  );
}