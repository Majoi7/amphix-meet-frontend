import { MicOff, PinIcon } from "lucide-react";
import {
  VideoTrack,
  AudioTrack,
  useIsSpeaking,
  useTrackMutedIndicator,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import type {
  TrackReferenceOrPlaceholder,
  TrackReference,
} from "@livekit/components-react";

interface ParticipantTileProps {
  trackRef: TrackReferenceOrPlaceholder;
  isLocal?: boolean;
  isScreenShare?: boolean;
  className?: string;
}

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

  const hasVideo = trackRef.publication && !trackRef.publication.isMuted;
  const displayName = trackRef.participant.name || trackRef.participant.identity;
  const initials = displayName.trim().slice(0, 1).toUpperCase() || "?";

  const containerClasses = [
    "group relative overflow-hidden bg-meet-tile",
    !isScreenShare && "aspect-video",
    !isScreenShare && "rounded-tile",
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
        <VideoTrack
          trackRef={trackRef as TrackReference}
          className={videoClasses}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-meet-blue text-2xl font-medium text-meet-bg sm:h-24 sm:w-24 sm:text-3xl">
            {initials}
          </div>
        </div>
      )}

      {!isLocal && trackRef.publication && (
        <AudioTrack trackRef={trackRef as TrackReference} />
      )}

      {!isScreenShare && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-black/50 px-2.5 py-1">
          <span className="text-xs font-medium text-white sm:text-sm">
            {displayName}
            {isLocal && " (vous)"}
          </span>
          {isMuted && <MicOff size={14} className="text-meet-red" />}
        </div>
      )}

      {isScreenShare && isLocal && (
        <div className="absolute top-3 left-3 z-10 rounded-md bg-meet-blue px-2.5 py-1 text-xs font-medium text-white">
          Vous présentez
        </div>
      )}

      {!isScreenShare && isMuted && (
        <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-black/50">
          <MicOff size={12} className="text-white" />
        </div>
      )}

      {trackRef.participant.isLocal && !isScreenShare && (
        <div className="absolute right-3 top-10 opacity-0 transition-opacity group-hover:opacity-100">
          <PinIcon size={14} className="text-white/70" />
        </div>
      )}
    </div>
  );
}