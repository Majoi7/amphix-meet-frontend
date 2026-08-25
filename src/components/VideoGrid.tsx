import { Track } from "livekit-client";
import {
  useTracks,
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";
import { ParticipantTile } from "./ParticipantTile";
import { useIsMobile } from "../hooks/useIsMobile";

export function VideoGrid() {
  const isMobile = useIsMobile();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const screenShareTrack = tracks.find(
    (t) => t.source === Track.Source.ScreenShare
  );
  const cameraTracks = tracks.filter(
    (t) => t.source === Track.Source.Camera
  );

  // Trie : l'orateur actif passe en premier (pour le mode spotlight)
  const speakingIds = new Set(
    participants.filter((p) => p.isSpeaking).map((p) => p.identity)
  );
  const sortedTracks = [...cameraTracks].sort((a, b) => {
    const aSp = speakingIds.has(a.participant.identity) ? 1 : 0;
    const bSp = speakingIds.has(b.participant.identity) ? 1 : 0;
    return bSp - aSp;
  });

  // ═════ Screen share garde son propre layout ═════
  if (screenShareTrack) {
    return isMobile ? (
      <ScreenShareMobileLayout
        screenShareTrack={screenShareTrack}
        cameraTracks={sortedTracks}
      />
    ) : (
      <ScreenShareDesktopLayout
        screenShareTrack={screenShareTrack}
        cameraTracks={sortedTracks}
      />
    );
  }

  const count = sortedTracks.length;
  const localIdentity = localParticipant?.identity;

  /* ═══════════════════════════════════════════════════════════════
     MOBILE — Comportement Google Meet
     ═══════════════════════════════════════════════════════════════ */
  if (isMobile) {
    // 1 seul participant
    if (count === 1) {
      return (
        <div className="flex h-full w-full items-center justify-center p-3">
          <div className="relative h-full w-full overflow-hidden rounded-2xl bg-meet-tile">
            <ParticipantTile
              trackRef={sortedTracks[0]}
              isLocal={sortedTracks[0].participant.isLocal}
              className="h-full w-full"
            />
          </div>
        </div>
      );
    }

    // 2 participants : l'autre plein écran, soi en vignette flottante
    if (count === 2) {
      const other =
        sortedTracks.find((t) => t.participant.identity !== localIdentity) ||
        sortedTracks[0];
      const me = sortedTracks.find(
        (t) => t.participant.identity === localIdentity
      );

      return (
        <div className="relative h-full w-full bg-black">
          {/* L'autre en plein écran */}
          <div className="h-full w-full">
            <ParticipantTile
              trackRef={other}
              isLocal={other.participant.isLocal}
              className="h-full w-full"
            />
          </div>

          {/* Soi-même : vignette flottante bas-droite */}
          {me && (
            <div className="absolute bottom-20 right-3 z-10 h-32 w-24 overflow-hidden rounded-2xl border border-white/10 shadow-2xl sm:h-36 sm:w-28">
              <ParticipantTile
                trackRef={me}
                isLocal
                className="h-full w-full"
              />
            </div>
          )}
        </div>
      );
    }

    // 3-4 participants : rectangles égaux empilés verticalement
    if (count <= 4) {
      return (
        <div className="flex h-full w-full flex-col gap-1.5 p-1.5">
          {sortedTracks.map((trackRef) => (
            <div
              key={trackRef.participant.identity}
              className="relative flex-1 overflow-hidden rounded-2xl bg-black"
            >
              <ParticipantTile
                trackRef={trackRef}
                isLocal={trackRef.participant.isLocal}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      );
    }

    // 5+ participants : Spotlight (orateur en haut) + bandeau scrollable
    const [spotlight, ...others] = sortedTracks;

    return (
      <div className="flex h-full w-full flex-col gap-1.5 p-1.5">
        {/* Spotlight — orateur actif, grande zone en haut */}
        <div className="relative h-[55%] overflow-hidden rounded-2xl bg-black">
          <ParticipantTile
            trackRef={spotlight}
            isLocal={spotlight.participant.isLocal}
            className="h-full w-full"
          />
        </div>

        {/* Bandeau horizontal scrollable — les autres */}
        <div className="flex h-[45%] gap-2 overflow-x-auto overflow-y-hidden pb-1 snap-x snap-mandatory">
          {others.map((trackRef) => (
            <div
              key={trackRef.participant.identity}
              className="h-full flex-shrink-0 snap-start overflow-hidden rounded-xl bg-black"
              style={{ aspectRatio: "3/4" }}
            >
              <ParticipantTile
                trackRef={trackRef}
                isLocal={trackRef.participant.isLocal}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     DESKTOP — Inchangé
     ═══════════════════════════════════════════════════════════════ */
  if (count === 1) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 sm:p-10">
        <div className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] bg-meet-tile shadow-2xl aspect-video">
          <ParticipantTile
            trackRef={sortedTracks[0]}
            isLocal={sortedTracks[0].participant.isLocal}
            className="h-full w-full"
          />
        </div>
      </div>
    );
  }

  const gridColsClass = getGridColsClass(count, false);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden p-4 sm:p-8">
      <div
        className={`grid w-full max-w-7xl gap-3 sm:gap-4 ${gridColsClass} auto-rows-fr`}
        style={{ maxHeight: "100%" }}
      >
        {sortedTracks.map((trackRef) => (
          <div
            key={trackRef.participant.identity}
            className="overflow-hidden rounded-2xl"
          >
            <ParticipantTile
              trackRef={trackRef}
              isLocal={trackRef.participant.isLocal}
              className="h-full w-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Layouts Screen Share
   ═══════════════════════════════════════════════════════════════ */

interface ScreenShareLayoutProps {
  screenShareTrack: ReturnType<typeof useTracks>[number];
  cameraTracks: ReturnType<typeof useTracks>;
}

function ScreenShareDesktopLayout({
  screenShareTrack,
  cameraTracks,
}: ScreenShareLayoutProps) {
  return (
    <div className="flex h-full w-full items-center justify-center gap-3 overflow-hidden p-4 sm:gap-4 sm:p-6">
      <div className="relative flex h-full flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black shadow-xl">
        <ParticipantTile
          trackRef={screenShareTrack}
          isScreenShare
          className="h-full w-full"
        />
      </div>

      {cameraTracks.length > 0 && (
        <div className="flex h-full w-28 flex-shrink-0 flex-col gap-2 overflow-y-auto sm:w-32">
          {cameraTracks.map((trackRef) => (
            <div
              key={trackRef.participant.identity}
              className="aspect-video w-full flex-shrink-0 overflow-hidden rounded-xl"
            >
              <ParticipantTile
                trackRef={trackRef}
                isLocal={trackRef.participant.isLocal}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScreenShareMobileLayout({
  screenShareTrack,
  cameraTracks,
}: ScreenShareLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-hidden p-2">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black">
        <ParticipantTile
          trackRef={screenShareTrack}
          isScreenShare
          className="h-full w-full"
        />
      </div>

      {cameraTracks.length > 0 && (
        <div className="flex h-16 flex-shrink-0 gap-2 overflow-x-auto">
          {cameraTracks.map((trackRef) => (
            <div
              key={trackRef.participant.identity}
              className="aspect-video h-full flex-shrink-0 overflow-hidden rounded-lg"
            >
              <ParticipantTile
                trackRef={trackRef}
                isLocal={trackRef.participant.isLocal}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getGridColsClass(count: number, _isMobile: boolean): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  if (count <= 4) return "grid-cols-2";
  if (count <= 6) return "grid-cols-3";
  return "grid-cols-4";
}