import { useEffect, useRef, useState } from "react";
import { Check, Link2, Share2, UserPlus } from "lucide-react";
import { useToast } from "./ToastProvider";

interface InviteButtonProps {
  roomId: string;
}

/**
 * Bouton "Inviter" dans l'en-tête de la réunion — ouvre un petit panneau
 * avec le lien complet à copier. Utilise l'API de partage native
 * (navigator.share) quand elle est disponible (surtout mobile), avec
 * repli sur la copie presse-papiers partout ailleurs.
 */
export function InviteButton({ roomId }: InviteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { pushToast } = useToast();

  const joinUrl = `${window.location.origin}/room/${roomId}`;
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    } catch {
      pushToast("Impossible de copier le lien.");
    }
  }

  async function handleShare() {
    try {
      await navigator.share({
        title: "Rejoins ma réunion Amphix Meet",
        text: `Rejoins-moi sur Amphix Meet : ${roomId}`,
        url: joinUrl,
      });
      setIsOpen(false);
    } catch {
      // L'utilisateur a annulé le partage — rien à faire.
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 rounded-full border border-meet-border px-3 py-1.5 text-xs font-medium text-meet-text-secondary transition-colors hover:bg-meet-control hover:text-meet-text-primary"
      >
        <UserPlus size={14} />
        <span className="hidden sm:inline">Inviter</span>
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-72 animate-slide-up rounded-xl bg-meet-bg-secondary p-3 shadow-2xl ring-1 ring-meet-border"
        >
          <p className="mb-2 text-xs text-meet-text-secondary">
            Partage ce lien pour inviter quelqu'un dans la réunion :
          </p>

          <div className="mb-3 flex items-center gap-2 rounded-lg bg-meet-control px-3 py-2">
            <Link2 size={14} className="flex-shrink-0 text-meet-text-secondary" />
            <span className="flex-1 truncate font-mono text-xs text-meet-text-primary">
              {joinUrl}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-meet-blue px-3 py-2 text-xs font-medium text-meet-bg transition-colors hover:bg-meet-blue-hover"
            >
              {justCopied ? <Check size={14} /> : <Link2 size={14} />}
              {justCopied ? "Copié !" : "Copier le lien"}
            </button>

            {canShare && (
              <button
                type="button"
                onClick={handleShare}
                aria-label="Partager"
                className="flex items-center justify-center rounded-full border border-meet-border px-3 py-2 text-meet-text-secondary transition-colors hover:bg-meet-control hover:text-meet-text-primary"
              >
                <Share2 size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
