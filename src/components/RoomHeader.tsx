import { useEffect, useState } from "react";
import { Info, Presentation, Sigma, Users } from "lucide-react";
import { useLocalParticipant, useParticipants } from "@livekit/components-react";
import { InviteButton } from "./InviteButton";
import { SessionTimer } from "./SessionTimer";
import { useElementSize } from "../hooks/useElementSize";

interface RoomHeaderProps {
  roomId: string;
  endsAt: string | null;
  /** Nombre de participants affiché dans la pilule. Optionnel : sinon
   *  le compteur est lu directement depuis LiveKit. */
  participantCount?: number;
  /** Ouvre le panneau des participants. C'est le MÊME panneau que celui du
   *  menu « Plus d'options » — cette pilule n'en crée pas un second. */
  onOpenParticipants?: () => void;
  /** Le panneau des participants est-il déjà ouvert ? (état visuel) */
  isParticipantsOpen?: boolean;
  /**
   * Hauteur réelle du header, mesurée et signalée au parent (ResizeObserver).
   *
   * C'est ce qui permet aux panneaux latéraux de s'ouvrir SOUS le header sans
   * répéter une constante : la zone occupée est mesurée, pas supposée.
   */
  onHeightChange?: (height: number) => void;
}

/** Horloge murale, rafraîchie à la minute — comme dans les maquettes. */
function useClock(): string {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  return now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Chrome de réunion.
 *
 * Ce n'est plus une barre opaque qui consomme de la hauteur : c'est une
 * surcouche flottante et transparente, posée au-dessus de la vidéo. Le
 * dégradé assure la lisibilité sur n'importe quelle image ; seuls les
 * éléments interactifs captent les clics, le reste laisse passer.
 *
 * Le composant est positionné en `absolute` : son parent doit être `relative`
 * et lui réserver un `padding-top` pour que les tuiles ne passent pas dessous.
 *
 * C'est ici que vit le badge « Vous présentez » : il appartient au chrome de
 * réunion, pas à une tuile. Posé sur la tuile du partage, il disparaissait
 * avec elle dès qu'un autre participant prenait la zone principale.
 */
export function RoomHeader({
  roomId,
  endsAt,
  participantCount,
  onOpenParticipants,
  isParticipantsOpen = false,
  onHeightChange,
}: RoomHeaderProps) {
  const participants = useParticipants();
  const { isScreenShareEnabled } = useLocalParticipant();
  const clock = useClock();
  const count = participantCount ?? participants.length;

  // Hauteur réellement occupée par le header, publiée vers le parent. Elle ne
  // dépend pas du contenu de la réunion : aucun risque de boucle de mise en
  // page, le parent ne fait que réserver cette hauteur.
  const { ref: headerRef, size: headerSize } = useElementSize<HTMLElement>();

  useEffect(() => {
    if (headerSize.height > 0) onHeightChange?.(headerSize.height);
  }, [headerSize.height, onHeightChange]);

  return (
    <header
      ref={headerRef}
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-14 items-center justify-between gap-3 bg-gradient-to-b from-black/55 via-black/25 to-transparent px-3 sm:px-4"
    >
      {/* Identité de la réunion */}
      <div className="pointer-events-auto flex min-w-0 items-center gap-2.5">
        <span className="hidden text-sm font-medium tabular-nums text-white/90 sm:inline">
          {clock}
        </span>
        <span className="hidden text-white/25 sm:inline">|</span>
        <span className="truncate text-sm font-medium text-white">Amphix Meet</span>
        <span className="hidden truncate font-mono text-xs text-white/45 sm:inline">· {roomId}</span>
        <span
          className="hidden h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:text-white/80 sm:flex"
          title="Informations sur la réunion"
        >
          <Info size={15} />
        </span>
      </div>

      {/* État et actions */}
      <div className="pointer-events-auto flex flex-shrink-0 items-center gap-2">
        {/* Partagé depuis le chrome : reste affiché même si la tuile du
            partage n'est plus la zone principale. */}
        {isScreenShareEnabled && (
          <span
            className="flex h-8 items-center gap-1.5 rounded-full bg-meet-blue px-2.5 text-xs font-medium text-white shadow ring-1 ring-white/15 sm:px-3"
            title="Vous partagez votre écran"
          >
            <Presentation size={13} className="flex-shrink-0" />
            <span className="hidden whitespace-nowrap sm:inline">Vous présentez</span>
          </span>
        )}

        {/* Espace mathématique — ouvert dans un NOUVEL ONGLET.
            C'est délibéré : la page mathématique vit hors de la salle
            LiveKit, et l'ouvrir dans cet onglet-ci démonterait la réunion
            (donc vous en ferait sortir). Un nouvel onglet laisse la réunion
            intacte et permet de travailler sur deux écrans. */}
        <a
          href={`/room/${roomId}/math`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ouvrir l'espace mathématique dans un nouvel onglet"
          title="Espace mathématique (nouvel onglet)"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white/90 ring-1 ring-white/10 backdrop-blur-md transition-colors duration-150 hover:bg-black/65 active:bg-white/20"
        >
          <Sigma size={15} className="text-white/70" aria-hidden="true" />
        </a>

        <button
          type="button"
          onClick={onOpenParticipants}
          aria-pressed={isParticipantsOpen}
          aria-label={`Participants (${count})`}
          title={`${count} participant${count > 1 ? "s" : ""} — voir la liste`}
          className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white/90 backdrop-blur-md ring-1 transition-colors duration-150 ${
            isParticipantsOpen
              ? "bg-white/20 ring-white/25"
              : "bg-black/45 ring-white/10 hover:bg-black/65 active:bg-white/20"
          }`}
        >
          <Users size={13} className="text-white/60" />
          <span className="tabular-nums">{count}</span>
        </button>

        <SessionTimer endsAt={endsAt} />
        <InviteButton roomId={roomId} />
      </div>
    </header>
  );
}
