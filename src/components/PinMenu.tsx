import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Globe, Pin, PinOff } from "lucide-react";

const MENU_WIDTH = 252;
const VIEWPORT_MARGIN = 8;
const ANCHOR_OFFSET = 6;

export interface PinMenuProps {
  /** Rectangle du bouton qui a ouvert le menu, en coordonnées viewport. */
  anchorRect: DOMRect;
  onClose: () => void;
  participantName: string;

  isLocallyPinned: boolean;
  onToggleLocalPin: () => void;

  isHost: boolean;
  isGloballyPinned: boolean;
  /** Un pin global existe déjà (peut-être sur une autre tuile). */
  hasGlobalPin: boolean;
  onSetGlobalPin: () => void;
  onClearGlobalPin: () => void;
}

/**
 * Menu d'épinglage — sombre, premium, rendu dans un portail.
 *
 * Le portail est indispensable : les tuiles vidéo portent `overflow-hidden`
 * (pour rogner la vidéo aux coins arrondis), ce qui coupait le menu à l'audit.
 * En sortant du conteneur, le menu n'est plus jamais rogné.
 *
 * Le positionnement tient compte des bords du viewport : le menu se replace
 * au-dessus de l'ancre s'il n'y a pas la place en dessous, et se recale
 * horizontalement s'il déborde à droite ou à gauche.
 */
export function PinMenu({
  anchorRect,
  onClose,
  participantName,
  isLocallyPinned,
  onToggleLocalPin,
  isHost,
  isGloballyPinned,
  hasGlobalPin,
  onSetGlobalPin,
  onClearGlobalPin,
}: PinMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuHeight, setMenuHeight] = useState(0);

  // Mesure réelle avant peinture : le repositionnement est invisible.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    setMenuHeight((prev) => (Math.abs(prev - h) < 1 ? prev : h));
  });

  // Fermeture au clic extérieur + Échap.
  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const el = menuRef.current;
      if (el && event.target instanceof Node && el.contains(event.target)) return;
      onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Si la page défile ou la fenêtre change de taille, l'ancre bouge :
  // on ferme plutôt que d'afficher un menu désaligné.
  useEffect(() => {
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const estimatedHeight = menuHeight || 150;
  const maxTop = window.innerHeight - estimatedHeight - VIEWPORT_MARGIN;

  let left = anchorRect.left;
  if (left + MENU_WIDTH > window.innerWidth - VIEWPORT_MARGIN) {
    left = anchorRect.right - MENU_WIDTH;
  }
  left = Math.min(
    Math.max(left, VIEWPORT_MARGIN),
    Math.max(window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN, VIEWPORT_MARGIN)
  );

  let top = anchorRect.bottom + ANCHOR_OFFSET;
  if (top + estimatedHeight > window.innerHeight - VIEWPORT_MARGIN) {
    const above = anchorRect.top - estimatedHeight - ANCHOR_OFFSET;
    top = above >= VIEWPORT_MARGIN ? above : Math.max(maxTop, VIEWPORT_MARGIN);
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Options d'épinglage pour ${participantName}`}
      style={{ left, top, width: MENU_WIDTH }}
      className="animate-menu-pop fixed z-[60] overflow-hidden rounded-2xl border border-white/10 bg-[rgba(28,28,30,0.98)] py-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.65)] backdrop-blur-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <MenuItem
        icon={isLocallyPinned ? <PinOff size={15} /> : <Pin size={15} />}
        label="Pour moi uniquement"
        hint="Visible seulement sur votre écran"
        active={isLocallyPinned}
        onClick={() => {
          onToggleLocalPin();
          onClose();
        }}
      />

      {isHost && (
        <>
          <div className="my-1.5 h-px bg-white/10" />
          <div className="px-3 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-wider text-white/35">
            Pour toute la réunion
          </div>

          {isGloballyPinned ? (
            <MenuItem
              icon={<Globe size={15} />}
              label="Retirer l'épinglage global"
              hint="Tout le monde revoit la grille normale"
              active
              onClick={() => {
                onClearGlobalPin();
                onClose();
              }}
            />
          ) : (
            <MenuItem
              icon={<Globe size={15} />}
              label="Pour tous les participants"
              hint={
                hasGlobalPin
                  ? "Remplacera l'épinglage global actuel"
                  : "Synchronisé sur tous les écrans"
              }
              active={false}
              onClick={() => {
                onSetGlobalPin();
                onClose();
              }}
            />
          )}
        </>
      )}
    </div>,
    document.body
  );
}

function MenuItem({
  icon,
  label,
  hint,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="group/item flex w-full items-start gap-3 px-3 py-2 text-left transition-colors duration-100 hover:bg-white/[0.08] focus-visible:bg-white/[0.08] focus-visible:outline-none"
    >
      <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center text-white/60 transition-colors group-hover/item:text-white">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-white">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] leading-tight text-white/40">{hint}</span>}
      </span>
      {active && <Check size={15} className="mt-0.5 flex-shrink-0 text-meet-blue" />}
    </button>
  );
}
