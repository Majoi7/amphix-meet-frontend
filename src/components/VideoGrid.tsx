import { Track } from "livekit-client";
import { useTracks } from "@livekit/components-react";
import { ParticipantTile } from "./ParticipantTile";
import { useIsMobile } from "../hooks/useIsMobile";

export function VideoGrid() {
  const isMobile = useIsMobile();
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

  if (screenShareTrack) {
    return isMobile ? (
      <ScreenShareMobileLayout
        screenShareTrack={screenShareTrack}
        cameraTracks={cameraTracks}
      />
    ) : (
      <ScreenShareDesktopLayout
        screenShareTrack={screenShareTrack}
        cameraTracks={cameraTracks}
      />
    );
  }

  // === 1 SEUL PARTICIPANT — cadre centré, bords très arrondis, pas trop grand ===
  if (cameraTracks.length === 1) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4 sm:p-8">
        <div className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] bg-meet-tile aspect-video shadow-2xl">
          <ParticipantTile
            trackRef={cameraTracks[0]}
            isLocal={cameraTracks[0].participant.isLocal}
            className="h-full w-full"
          />
        </div>
      </div>
    );
  }

  // === PLUSIEURS PARTICIPANTS ===
  const gridColsClass = getGridColsClass(cameraTracks.length, isMobile);

  return (
    <div className="flex h-full w-full items-center justify-center p-3 sm:p-5">
      <div
        className={`grid h-full w-full max-w-7xl gap-3 ${gridColsClass} auto-rows-fr`}
      >
        {cameraTracks.map((trackRef) => (
          <ParticipantTile
            key={trackRef.participant.identity}
            trackRef={trackRef}
            isLocal={trackRef.participant.isLocal}
            className="h-full w-full"
          />
        ))}
      </div>
    </div>
  );
}

interface ScreenShareLayoutProps {
  screenShareTrack: ReturnType<typeof useTracks>[number];
  cameraTracks: ReturnType<typeof useTracks>;
}

/**
 * DESKTOP — Screen share centré et large, colonne participants discrète à droite
 */
function ScreenShareDesktopLayout({
  screenShareTrack,
  cameraTracks,
}: ScreenShareLayoutProps) {
  return (
    <div className="flex h-full w-full items-center justify-center gap-3 p-3 sm:gap-4 sm:p-6">
      {/* Screen share principal */}
      <div className="relative h-full flex-1 overflow-hidden rounded-2xl bg-black shadow-xl">
        <ParticipantTile
          trackRef={screenShareTrack}
          isScreenShare
          className="h-full w-full"
        />
      </div>

      {/* Colonne participants — tuiles identiques au mode normal */}
      {cameraTracks.length > 0 && (
        <div className="flex h-full w-24 flex-shrink-0 flex-col gap-2 overflow-y-auto sm:w-28">
          {cameraTracks.map((trackRef) => (
            <ParticipantTile
              key={trackRef.participant.identity}
              trackRef={trackRef}
              isLocal={trackRef.participant.isLocal}
              className="w-full"
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * MOBILE — Screen share en haut, bandeau participants en bas
 */
function ScreenShareMobileLayout({
  screenShareTrack,
  cameraTracks,
}: ScreenShareLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col gap-2 p-2">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-black">
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

function getGridColsClass(count: number, isMobile: boolean): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return isMobile ? "grid-cols-1" : "grid-cols-2";
  if (isMobile) return "grid-cols-2";
  if (count <= 4) return "grid-cols-2";
  if (count <= 6) return "grid-cols-3";
  return "grid-cols-4";
}