import { useEffect, useRef } from "react";
import { Clock } from "lucide-react";
import { useMeetingCountdown } from "../hooks/useMeetingCountdown";
import { useToast } from "./ToastProvider";

interface SessionTimerProps {
  endsAt: string | null;
}

/**
 * Affiche le temps restant de la séance. Passe au jaune à 5 minutes de la
 * fin (avec une notification une seule fois), au rouge une fois terminée.
 * N'affiche rien si endsAt est absent (ne devrait pas arriver en usage
 * normal, mais évite un affichage cassé si jamais).
 */
export function SessionTimer({ endsAt }: SessionTimerProps) {
  const { formatted, isEndingSoon, isEnded } = useMeetingCountdown(endsAt);
  const { pushToast } = useToast();
  const hasWarnedRef = useRef(false);

  useEffect(() => {
    if (isEndingSoon && !hasWarnedRef.current) {
      hasWarnedRef.current = true;
      pushToast("Votre séance se termine dans 5 minutes.");
    }
  }, [isEndingSoon, pushToast]);

  if (!endsAt) return null;

  return (
    <div
      className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:flex ${
        isEnded
          ? "bg-meet-red text-white"
          : isEndingSoon
            ? "bg-meet-yellow text-meet-bg"
            : "text-meet-text-secondary"
      }`}
    >
      <Clock size={12} />
      {isEnded ? "Séance terminée" : formatted}
    </div>
  );
}
