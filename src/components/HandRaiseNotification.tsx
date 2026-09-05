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

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center space-x-3 p-4 rounded-xl bg-black/80 backdrop-blur-md text-white shadow-xl transform transition-all duration-300 ${
      !animateComplete
        ? "translate-y-full opacity-0"
        : animateComplete
        ? "translate-y-0 scale-100"
        : "translate-y-0 scale-95"
    }`}>
      {/* Baby turtle emoji */}
      <div className="text-2xl">🐢</div>
      <div>
        <p className="font-medium">{name} a levé la main</p>
      </div>
      {/* Optional: close button */}
      <button
        onClick={() => onRemove(id)}
        className="ml-4 text-white/hover text-sm hover:text-white"
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  );
}