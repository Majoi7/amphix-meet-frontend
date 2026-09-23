import { useEffect, useRef } from "react";

/**
 * Ferme un menu surgissant au clic extérieur et à la touche Échap.
 *
 * Les deux fermetures vont ensemble : un menu qui ne se ferme qu'au clic
 * oblige les utilisateurs au clavier à tabuler jusqu'au bout de la page
 * pour s'en débarrasser. Échap est le geste attendu, on l'implémente donc
 * ici, une fois, plutôt que dans chaque menu.
 */
export function useDismissable<T extends HTMLElement>(
  isOpen: boolean,
  onClose: () => void
): React.MutableRefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  return ref;
}
