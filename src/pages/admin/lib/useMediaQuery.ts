import { useEffect, useState } from "react";

/**
 * `matchMedia` réactif.
 *
 * L'administration a besoin d'un point de rupture à 1024 px (barre latérale
 * fixe au-dessus, tiroir en dessous) que `useIsMobile` — calé sur 640 px,
 * pour les panneaux de la réunion — ne fournit pas. Ce hook est local à
 * l'administration et ne touche pas au hook de la réunion.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    function handleChange(event: MediaQueryListEvent) {
      setMatches(event.matches);
    }
    media.addEventListener("change", handleChange);
    setMatches(media.matches);
    return () => media.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

/** Barre latérale fixe à partir de 1024 px, tiroir en dessous. */
export const DESKTOP_QUERY = "(min-width: 1024px)";
