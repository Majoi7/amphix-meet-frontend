import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Piège le focus dans un panneau modal.
 *
 * Le tiroir de navigation recouvre la page : sans piège, la tabulation
 * continuerait d'atteindre les liens situés DERRIÈRE l'overlay — invisibles
 * mais focalisables. Le focus entre dans le panneau à l'ouverture, en fait
 * le tour, et en sort quand le panneau se ferme.
 */
export function useFocusTrap<T extends HTMLElement>(
  isActive: boolean
): React.MutableRefObject<T | null> {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    if (!isActive) return;
    const node = containerRef.current;
    if (!node) return;

    function focusables(): HTMLElement[] {
      return Array.from(node!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    }

    focusables()[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !node!.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive]);

  return containerRef;
}
