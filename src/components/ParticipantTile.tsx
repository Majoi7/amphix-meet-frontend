import { MicOff, Pin, PinOff } from "lucide-react";
import {
  VideoTrack,
  useIsSpeaking,
  useTrackMutedIndicator,
  useConnectionQualityIndicator,
} from "@livekit/components-react";
import { ConnectionQuality, Track } from "livekit-client";
import type {
  TrackReferenceOrPlaceholder,
  TrackReference,
} from "@livekit/components-react";
import { resolveAvatar } from "../lib/avatarColor";
import { memo, useCallback, useState } from "react";
import { PinMenu } from "./PinMenu";

interface ParticipantTileProps {
  trackRef: TrackReferenceOrPlaceholder;
  isLocal?: boolean;
  isScreenShare?: boolean;
  /** Épinglée pour moi. */
  isPinned?: boolean;
  /** Tuile épinglée globalement (partagée avec toute la réunion). */
  globalPinnedTrack: TrackReferenceOrPlaceholder | null;
  onTogglePin?: (trackRef: TrackReferenceOrPlaceholder) => void;
  onRequestGlobalPin: (trackRef: TrackReferenceOrPlaceholder | null) => void;
  className?: string;
  isHost?: boolean;
  /**
   * La tuile remplit son conteneur sans imposer de ratio : c'est le moteur de
   * layout qui décide de sa géométrie. Sans ce mode, la tuile garde son
   * comportement historique (ratio carré pour la caméra).
   */
  fill?: boolean;
  /** Masqué quand on est seul en réunion — épingler n'a alors aucun sens. */
  showPinButton?: boolean;
  radius?: "lg" | "xl" | "2xl";
}

const RADIUS_CLASS: Record<NonNullable<ParticipantTileProps["radius"]>, string> = {
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
};

/**
 * Tuile d'un participant. Quatre états visuels distincts :
 *
 * - **caméra active**    → vidéo `object-cover`, mirroir si locale
 * - **caméra coupée**    → fond couleur du participant + avatar (photo ou initiales)
 * - **partage d'écran**  → vidéo `object-contain` (on ne rogne jamais du contenu
 *                          partagé), ni nom ni badge micro
 * - **orateur actif**    → anneau bleu
 *
 * Le bouton d'épinglage ouvre un menu rendu dans un PORTAIL : il n'est donc
 * jamais rogné par l'`overflow-hidden` qui sert à découper la vidéo.
 */
/**
 * Mémoïsé : pendant un redimensionnement, le moteur recalcule à chaque frame.
 * Sans ce memo, chaque tuile (et sa `VideoTrack`) se redessinerait pour rien.
 * Les callbacks reçus sont stables, donc la comparaison superficielle suffit.
 */
export const ParticipantTile = memo(function ParticipantTile({
  trackRef,
  isLocal = false,
  isScreenShare = false,
  isPinned = false,
  globalPinnedTrack,
  onTogglePin,
  onRequestGlobalPin,
  className = "",
  isHost = false,
  fill = false,
  showPinButton = true,
  radius = "2xl",
}: ParticipantTileProps) {
  const isSpeaking = useIsSpeaking(trackRef.participant);
  const { isMuted } = useTrackMutedIndicator({
    participant: trackRef.participant,
    source: Track.Source.Microphone,
  });
  const { quality } = useConnectionQualityIndicator({ participant: trackRef.participant });

  // Le menu est ancré sur le bouton, en coordonnées viewport (portail oblige).
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const closeMenu = useCallback(() => setAnchorRect(null), []);

  const hasVideo = trackRef.publication && !trackRef.publication.isMuted;
  const displayName = trackRef.participant.name || trackRef.participant.identity;

  // Règle partagée avec le panneau participants, le chat et l'aperçu
  // d'avant-réunion : photo si disponible, sinon initiales + couleur. La
  // tuile n'a plus sa propre lecture du metadata — c'est ce qui faisait
  // diverger l'affichage d'un même participant selon l'endroit.
  const avatar = resolveAvatar({
    identity: trackRef.participant.identity,
    name: trackRef.participant.name,
    metadata: trackRef.participant.metadata,
  });

  // URL dont le chargement a échoué. On mémorise l'URL fautive plutôt qu'un
  // simple booléen : si la photo change, la nouvelle URL ne correspond plus
  // et la photo réapparaît d'elle-même.
  const [brokenPhotoUrl, setBrokenPhotoUrl] = useState<string | null>(null);
  const photoUrl =
    avatar.photoUrl && avatar.photoUrl !== brokenPhotoUrl ? avatar.photoUrl : null;

  const isCurrentlyGlobalPinned =
    !!globalPinnedTrack &&
    trackRef.participant.identity === globalPinnedTrack.participant.identity &&
    trackRef.source === globalPinnedTrack.source;
  const hasGlobalPin = !!globalPinnedTrack;

  const containerClasses = [
    "group relative overflow-hidden bg-meet-tile",
    !fill && !isScreenShare && "aspect-square",
    RADIUS_CLASS[radius],
    isSpeaking && !isScreenShare && "ring-2 ring-meet-blue",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const videoClasses = [
    "h-full w-full",
    isScreenShare ? "object-contain" : "object-cover",
    !isScreenShare && isLocal && "-scale-x-100",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses}>
      {hasVideo ? (
        <VideoTrack trackRef={trackRef as TrackReference} className={videoClasses} />
      ) : (
        <div
          className="relative flex h-full w-full items-center justify-center"
          style={{ backgroundColor: avatar.color }}
        >
          {/* Voile sombre pour garder le nom et les badges lisibles */}
          <div className="absolute inset-0 bg-black/20" />
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              // Une photo cassée — supprimée, hôte injoignable, image bloquée —
              // ne doit jamais laisser une icône d'image brisée à la place du
              // profil. On retombe sur les initiales.
              onError={() => setBrokenPhotoUrl(photoUrl)}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="relative h-16 w-16 rounded-full object-cover shadow-lg ring-4 ring-white/25 sm:h-24 sm:w-24"
            />
          ) : (
            <div
              className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-xl font-medium shadow-lg ring-4 ring-white/25 sm:h-24 sm:w-24 sm:text-3xl"
              style={{ color: avatar.color }}
            >
              {avatar.initials}
            </div>
          )}
        </div>
      )}

      {/* Nom + dégradé de lisibilité — jamais sur un partage d'écran */}
      {!isScreenShare && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/60 to-transparent" />
          <span className="absolute bottom-2.5 left-3 max-w-[calc(100%-1.5rem)] truncate text-sm font-medium text-white drop-shadow">
            {displayName}
            {isLocal && " (vous)"}
          </span>
        </>
      )}

      {!isScreenShare && isMuted && (
        <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-meet-blue/90 shadow">
          <MicOff size={14} className="text-white" />
        </div>
      )}

      {/* Bouton d'épinglage unique — ouvre le menu « pour moi / pour tous ».
          Centré sur la tuile : c'est le seul endroit qui reste libre quel que
          soit le contenu (vidéo, avatar, partage d'écran), et il ne peut donc
          être confondu ni avec le badge micro (haut droite), ni avec le nom
          (bas gauche), ni avec l'indicateur d'orateur (anneau).

          Sa visibilité est pilotée par `.pin-button` (index.css) : masqué au
          repos sur les appareils qui savent survoler, révélé au survol et au
          focus clavier ; TOUJOURS visible sur écran tactile, où le survol
          n'existe pas. */}
      {showPinButton && (
        <button
          type="button"
          onClick={(event) => {
            // Sans ça, le clic remonterait jusqu'au <main> et masquerait
            // la barre de contrôle.
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            setAnchorRect((prev) => (prev ? null : rect));
          }}
          aria-haspopup="menu"
          aria-expanded={!!anchorRect}
          aria-label="Options d'épinglage"
          title="Épingler"
          className={`pin-button absolute left-1/2 top-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm transition-all duration-150 hover:bg-black/75 ${
            isPinned || isCurrentlyGlobalPinned ? "pin-button-active" : ""
          }`}
        >
          {isPinned || isCurrentlyGlobalPinned ? <PinOff size={18} /> : <Pin size={18} />}
          {/* Pastille : distingue d'un coup d'œil le pin global du pin local */}
          {isCurrentlyGlobalPinned && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-black/60 bg-meet-blue" />
          )}
        </button>
      )}

      {!isScreenShare && quality !== ConnectionQuality.Excellent && (
        <div
          className="absolute bottom-2.5 right-3 h-2.5 w-2.5 rounded-full shadow"
          title={
            quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost
              ? "Connexion faible"
              : "Connexion moyenne"
          }
          style={{
            backgroundColor:
              quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost
                ? "#ea4335"
                : "#fbbc04",
          }}
        />
      )}

      {anchorRect && onTogglePin && (
        <PinMenu
          anchorRect={anchorRect}
          onClose={closeMenu}
          participantName={displayName}
          isLocallyPinned={isPinned}
          onToggleLocalPin={() => onTogglePin(trackRef)}
          isHost={isHost}
          isGloballyPinned={isCurrentlyGlobalPinned}
          hasGlobalPin={hasGlobalPin}
          onSetGlobalPin={() => onRequestGlobalPin(trackRef)}
          onClearGlobalPin={() => onRequestGlobalPin(null)}
        />
      )}
    </div>
  );
});
