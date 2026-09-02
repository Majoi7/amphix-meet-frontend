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
import { getAvatarColor } from "../lib/avatarColor";

interface ParticipantTileProps {
  trackRef: TrackReferenceOrPlaceholder;
  isLocal?: boolean;
  isScreenShare?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  className?: string;
}

interface ParticipantMetadata {
  avatarUrl?: string;
}

function parseAvatarUrl(metadata: string | undefined): string | undefined {
  if (!metadata) return undefined;
  try {
    const parsed = JSON.parse(metadata) as ParticipantMetadata;
    return parsed.avatarUrl || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Tuile d'un participant :
 * - Caméra : ratio CARRÉ (1/1), coins arrondis.
 * - Nom en texte simple sur dégradé bas.
 * - UN SEUL badge micro coupé, en haut à droite.
 * - Qualité réseau : point discret, affiché seulement si dégradée.
 * - Screen share : object-contain, pas de ratio forcé.
 * - Caméra coupée : tuile entière remplie de la couleur du participant,
 *   avatar (photo ou initiales) affiché en rond par-dessus, contrasté.
 */
export function ParticipantTile({
  trackRef,
  isLocal = false,
  isScreenShare = false,
  isPinned = false,
  onTogglePin,
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
  const avatarUrl = parseAvatarUrl(trackRef.participant.metadata);

  const containerClasses = [
    "group relative overflow-hidden bg-meet-tile transition-shadow duration-150",
    !isScreenShare && "aspect-square",
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
        <div
          className="relative flex h-full w-full items-center justify-center"
          style={{ backgroundColor: avatarColor }}
        >
          {/* Voile sombre pour garder le nom/les badges lisibles sur une couleur claire */}
          <div className="absolute inset-0 bg-black/20" />
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="relative h-16 w-16 rounded-full object-cover shadow-lg ring-4 ring-white/25 sm:h-24 sm:w-24"
            />
          ) : (
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-xl font-medium shadow-lg ring-4 ring-white/25 sm:h-24 sm:w-24 sm:text-3xl" style={{ color: avatarColor }}>
              {initials}
            </div>
          )}
        </div>
      )}

      {!isScreenShare && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/60 to-transparent" />
          <span className="absolute bottom-2.5 left-3 text-sm font-medium text-white drop-shadow">
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

      {!isScreenShare && onTogglePin && (
        <button
          type="button"
          onClick={onTogglePin}
          aria-label={isPinned ? "Désépingler" : "Épingler"}
          title={isPinned ? "Désépingler" : "Épingler"}
          className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 shadow transition-opacity duration-150 hover:bg-black/70 group-hover:opacity-100"
        >
          {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
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

      {isScreenShare && isLocal && (
        <div className="absolute left-3 top-3 z-10 rounded bg-meet-blue px-2 py-0.5 text-xs font-medium text-white">
          Vous présentez
        </div>
      )}
    </div>
  );
}