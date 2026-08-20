import { useCallback, useEffect, useState } from "react";

interface UseFullscreenResult {
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

/**
 * Bascule le document entier en plein écran. Utile en réunion pour
 * masquer la barre d'adresse et gagner de l'espace, surtout en présentant
 * un partage d'écran.
 */
export function useFullscreen(): UseFullscreenResult {
  const [isFullscreen, setIsFullscreen] = useState(
    () => document.fullscreenElement !== null
  );

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(document.fullscreenElement !== null);
    }
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {
        // L'utilisateur a peut-être déjà quitté le plein écran autrement — pas grave.
      });
    } else {
      document.documentElement.requestFullscreen().catch(() => {
        // Certains navigateurs refusent sans interaction directe de l'utilisateur.
      });
    }
  }, []);

  return { isFullscreen, toggleFullscreen };
}
