import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT_PX = 640; // correspond à "sm" dans Tailwind

/**
 * Détecte si l'écran est en dessous du breakpoint mobile. Utilisé pour
 * basculer les panneaux (chat, participants) entre mode "sidebar" (desktop)
 * et mode "overlay plein écran" (mobile), et pour adapter la grille vidéo
 * pendant un partage d'écran.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < MOBILE_BREAKPOINT_PX
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    function handleChange(e: MediaQueryListEvent) {
      setIsMobile(e.matches);
    }
    mediaQuery.addEventListener("change", handleChange);
    setIsMobile(mediaQuery.matches);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isMobile;
}
