import { useEffect, useRef, useState } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Mesure la taille RÉELLE d'un élément et la met à jour à chaque
 * redimensionnement — fenêtre, ouverture/fermeture d'un panneau, rotation
 * mobile, zoom navigateur.
 *
 * On mesure le conteneur et non `window.innerWidth` : c'est la seule façon
 * de savoir combien d'espace il reste vraiment à la vidéo une fois le chat
 * ou le panneau participants ouverts.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Valeur immédiate, avant la première notification du ResizeObserver —
    // évite un rendu à 0×0 puis un saut visuel.
    const initial = element.getBoundingClientRect();
    setSize({ width: initial.width, height: initial.height });

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      // `contentRect` ignore les paddings/borders : c'est exactement la zone
      // dans laquelle les tuiles peuvent être dessinées.
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        // Évite les mises à jour pour un écart sub-pixel, qui provoqueraient
        // des rendus en boucle.
        Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
          ? prev
          : { width, height }
      );
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}
