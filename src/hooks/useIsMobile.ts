import { useEffect, useState } from "react";

/** Correspond à "sm" dans Tailwind. */
const MOBILE_BREAKPOINT_PX = 640;

/**
 * « Cet appareil est-il un mobile ? »
 *
 * Deux clauses, et la seconde est essentielle :
 *
 *   1. `max-width: 639px` — le seuil historique, celui des panneaux et de la
 *      grille ;
 *   2. `(hover: none) and (pointer: coarse)` — un appareil TACTILE, sans
 *      survol possible.
 *
 * Sans la seconde, un téléphone en PAYSAGE mesurait 844 × 390 : au-dessus de
 * 640 px, donc classé « desktop ». Toute l'interface basculait au moment
 * précis où l'on tourne l'appareil — et pour un partage d'écran, c'est-à-dire
 * exactement le geste pour lequel on tourne. Le bouton d'épinglage
 * réapparaissait, la barre de contrôle changeait de hauteur, les panneaux
 * passaient de la superposition à la colonne latérale.
 *
 * La clause tactile est la convention DÉJÀ utilisée par le projet pour
 * `.pin-button` dans `index.css` : les deux s'accordent maintenant au lieu de
 * se contredire.
 *
 * Un poste de bureau, avec souris et survol, ne satisfait jamais la seconde
 * clause : sa détection est donc strictement inchangée.
 */
const MOBILE_MEDIA_QUERY = `(max-width: ${
  MOBILE_BREAKPOINT_PX - 1
}px), ((hover: none) and (pointer: coarse))`;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia(MOBILE_MEDIA_QUERY).matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    function handleChange(e: MediaQueryListEvent) {
      setIsMobile(e.matches);
    }
    mediaQuery.addEventListener("change", handleChange);
    // La valeur est relue au montage : entre l'initialisation du state et
    // l'abonnement, un changement de media query aurait pu être manqué.
    setIsMobile(mediaQuery.matches);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isMobile;
}
