import { useEffect, useState } from "react";

interface CountdownState {
  isEndingSoon: boolean; // ≤ 5 minutes restantes
  isEnded: boolean;
  formatted: string; // "01:43:27" ou "43:27"
}

/**
 * Compte à rebours jusqu'à endsAt. Purement côté client pour l'affichage
 * — la vraie source de vérité qui ferme la salle est le scheduler
 * backend (meetingScheduler.ts, vérifie toutes les 60s), pas ce hook.
 * Si endsAt est null (pas de limite connue), retourne un état neutre.
 */
export function useMeetingCountdown(endsAt: string | null): CountdownState {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (!endsAt) {
    return { isEndingSoon: false, isEnded: false, formatted: "" };
  }

  const remainingMs = Math.max(0, new Date(endsAt).getTime() - now);
  const isEnded = remainingMs <= 0;
  const isEndingSoon = remainingMs > 0 && remainingMs <= 5 * 60 * 1000;

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  const formatted =
    hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;

  return { isEndingSoon, isEnded, formatted };
}
