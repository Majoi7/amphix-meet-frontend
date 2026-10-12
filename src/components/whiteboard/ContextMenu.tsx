import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

export interface ContextMenuItem {
  id: string;
  label: string;
  /** Raccourci affiché à droite. Purement informatif : c'est le gestionnaire
   *  clavier de `Whiteboard` qui l'applique, pas ce menu. */
  shortcut?: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Une action destructrice se signale par la couleur d'alerte. */
  danger?: boolean;
}

interface ContextMenuProps {
  /** Position du clic, en coordonnées viewport (`clientX` / `clientY`). */
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/**
 * Dimensions exprimées en constantes plutôt que mesurées après montage : elles
 * servent uniquement à maintenir le menu DANS la fenêtre, et une estimation
 * exacte éviterait un rendu puis une correction visible. Elles doivent rester
 * cohérentes avec `w-52` et `h-9` ci-dessous.
 */
const MENU_WIDTH = 208;
const ITEM_HEIGHT = 36;
const MENU_PADDING = 8;
const VIEWPORT_MARGIN = 8;

/**
 * Menu contextuel du tableau blanc.
 *
 * Posé en `fixed` aux coordonnées du clic : le tableau est un canvas plein
 * cadre, et convertir en coordonnées locales n'apporterait rien qu'une source
 * d'erreur de plus.
 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(() =>
    items.findIndex((item) => !item.disabled)
  );

  // `onClose` est recréé à chaque rendu du parent. Le garder dans une
  // référence laisse l'effet ci-dessous stable : sans cela, les écouteurs
  // globaux seraient retirés et reposés à chaque rendu.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const height = items.length * ITEM_HEIGHT + MENU_PADDING * 2;
  const left = Math.max(VIEWPORT_MARGIN, Math.min(x, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN));
  const top = Math.max(VIEWPORT_MARGIN, Math.min(y, window.innerHeight - height - VIEWPORT_MARGIN));

  useEffect(() => {
    if (activeIndex >= 0) itemRefs.current[activeIndex]?.focus();
  }, [activeIndex]);

  // Fermeture : clic extérieur, redimensionnement, perte de focus de la
  // fenêtre, et molette. Le tableau se déplace et zoome à la molette — un
  // menu ancré à une position viewport ne suivrait pas le trait qu'il
  // désigne, mieux vaut le refermer que le laisser mentir.
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      onCloseRef.current();
    }
    function handleDismiss() {
      onCloseRef.current();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleDismiss);
    window.addEventListener("blur", handleDismiss);
    window.addEventListener("wheel", handleDismiss, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleDismiss);
      window.removeEventListener("blur", handleDismiss);
      window.removeEventListener("wheel", handleDismiss);
    };
  }, []);

  /** Déplace l'entrée active en sautant les entrées désactivées. */
  function move(delta: number) {
    if (items.length === 0) return;
    let next = activeIndex;
    for (let step = 0; step < items.length; step++) {
      next = (next + delta + items.length) % items.length;
      if (!items[next].disabled) break;
    }
    setActiveIndex(next);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCloseRef.current();
    }
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Actions sur la sélection"
      onKeyDown={handleKeyDown}
      className="fixed z-50 w-52 rounded-xl bg-meet-bg-secondary p-1 shadow-2xl ring-1 ring-meet-border"
      style={{ left, top }}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={(node) => {
            itemRefs.current[index] = node;
          }}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          tabIndex={index === activeIndex ? 0 : -1}
          onClick={() => {
            item.onSelect();
            onCloseRef.current();
          }}
          onMouseEnter={() => {
            if (!item.disabled) setActiveIndex(index);
          }}
          className={`flex h-9 w-full items-center justify-between gap-4 rounded-lg px-3 text-left text-sm transition-colors ${
            item.disabled
              ? "cursor-not-allowed text-meet-text-disabled"
              : item.danger
              ? "text-meet-red hover:bg-meet-control"
              : "text-meet-text-primary hover:bg-meet-control"
          }`}
        >
          <span>{item.label}</span>
          {item.shortcut && (
            <span className="font-mono text-[10px] text-meet-text-disabled">{item.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  );
}
