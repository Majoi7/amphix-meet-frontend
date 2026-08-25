import { MicOff } from "lucide-react";
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
import { getAvatarColor } from "../lib/avatarColor";

interface ParticipantTileProps {
  trackRef: TrackReferenceOrPlaceholder;
  isLocal?: boolean;
  isScreenShare?: boolean;
  className?: string;
}

/**
 * Tuile d'un participant, calquée sur le rendu Google Meet :
 * - Caméra : ratio 16/9, coins arrondis.
 * - Nom en texte simple sur dégradé bas (pas de pastille pleine) — style
 *   Meet établi en Session 8, ne pas revenir à une pastille sans raison.
 * - UN SEUL badge micro coupé, en haut à droite (pas de doublon avec le
 *   nom).
 * - Qualité réseau : point discret, affiché seulement si dégradée.
 * - Screen share : object-contain, pas de ratio forcé.
 */
export function ParticipantTile({
  trackRef,
  isLocal = false,
  isScreenShare = false,
  className = "",
}: ParticipantTileProps) {
  const isSpeaking = useIsSpeaking(trackRef.participant);
  const { isMuted } = useTrackMutedIndicator({
    participant: trackRef.participant,
    source: Track.Source.Microphone,
  });
  const { quality } = useConnectionQualityIndicator({ participant: trackRef.participant });

  const hasVideo = trackRef.publication && !trackRef.publication.isMuted;
  const displayName = trackRef.participant.name || trackRef.participant.identity;
  const initials = displayName.trim().slice(0, 1).toUpperCase() || "?";
  const avatarColor = getAvatarColor(trackRef.participant.identity);

  const containerClasses = [
    "group relative overflow-hidden bg-meet-tile transition-shadow duration-150",
    !isScreenShare && "aspect-video",
    "rounded-2xl",
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
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#3c4c73] to-[#1f2536]">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-medium text-meet-bg shadow-lg sm:h-28 sm:w-28 sm:text-4xl"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </div>
        </div>
      )}

      {!isScreenShare && (
        <>
          {/* Dégradé bas pour la lisibilité du nom, sans pastille pleine — style Meet */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/60 to-transparent" />
          <span className="absolute bottom-2.5 left-3 text-sm font-medium text-white drop-shadow">
            {displayName}
            {isLocal && " (vous)"}
          </span>
        </>
      )}

      {/* Badge micro coupé — UN SEUL, coin haut-droit de la tuile */}
      {!isScreenShare && isMuted && (
        <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-meet-blue/90 shadow">
          <MicOff size={14} className="text-white" />
        </div>
      )}

      {/* Qualité réseau — affichée seulement si dégradée */}
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

      {/* Badge "Vous présentez" uniquement pour screen share local */}
      {isScreenShare && isLocal && (
        <div className="absolute left-3 top-3 z-10 rounded bg-meet-blue px-2 py-0.5 text-xs font-medium text-white">
          Vous présentez
        </div>
      )}
    </div>
  );
}
