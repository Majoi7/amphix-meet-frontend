import { useState } from "react";
import { Track } from "livekit-client";
import {
  useTracks,
  useLocalParticipant,
  useIsSpeaking,
} from "@livekit/components-react";
import { ParticipantTile } from "./ParticipantTile";
import { useIsMobile } from "../hooks/useIsMobile";

// Wrapper component to properly handle useIsSpeaking hook
function ParticipantTileWithSpeaking({
  trackRef,
  isLocal,
  className,
  onTogglePin,
  isPinned,
  isScreenShare
}: {
  trackRef: ReturnType<typeof useTracks>[number];
  isLocal: boolean;
  className?: string;
  onTogglePin?: () => void;
  isPinned?: boolean;
  isScreenShare?: boolean;
}) {
  const isSpeaking = useIsSpeaking(trackRef.participant);

  // Build className with speaking effect if applicable
  const speakingClassName = isSpeaking ? "ring-2 ring-blue-500/75 animate-pulse" : "";
  const finalClassName = `${className || ""} ${speakingClassName}`.trim();

  return (
    <ParticipantTile
      trackRef={trackRef}
      isLocal={isLocal}
      className={finalClassName}
      onTogglePin={onTogglePin}
      isPinned={isPinned}
      isScreenShare={isScreenShare}
    />
  );
}

export function VideoGrid() {
  const isMobile = useIsMobile();
  const { localParticipant } = useLocalParticipant();
  const [pinnedIdentity, setPinnedIdentity] = useState<string | null>(null);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const screenShareTrack = tracks.find((t) => t.source === Track.Source.ScreenShare);

  // Ordre STABLE — on ne trie plus par "qui parle en ce moment" : ça
  // faisait sauter les tuiles de position à chaque prise de parole.
  // Pour mettre quelqu'un en avant, on utilise désormais l'épingle
  // (bouton sur la tuile) plutôt qu'un tri automatique.
  const cameraTracks = tracks.filter((t) => t.source === Track.Source.Camera);

  function togglePin(identity: string) {
    setPinnedIdentity((current) => (current === identity ? null : identity));
  }

  // Si la personne épinglée quitte la réunion ou coupe sa caméra, on se
  // rabat proprement sur la grille plutôt que d'afficher un spotlight vide.
  const pinnedTrack = pinnedIdentity
    ? cameraTracks.find((t) => t.participant.identity === pinnedIdentity)
    : undefined;

  // ═════ Screen share garde son propre layout — prioritaire sur l'épingle ═════
  if (screenShareTrack) {
    return (
      <div className="relative flex h-full w-full items-center justify-center gap-3 overflow-hidden p-4 sm:gap-4 sm:p-6">
        {/* Main content: screen share left, camera tracks right */}
        <div className="relative flex h-full flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black shadow-xl">
          <ParticipantTileWithSpeaking
            trackRef={screenShareTrack}
            isLocal={screenShareTrack.participant.isLocal}
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
                <ParticipantTileWithSpeaking
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

  // ═════ Spotlight — quelqu'un est épinglé ═════
  if (pinnedTrack) {
    const others = cameraTracks.filter((t) => t.participant.identity !== pinnedIdentity);
    return isMobile ? (
      <PinnedMobileLayout pinnedTrack={pinnedTrack} others={others} onTogglePin={togglePin} />
    ) : (
      <PinnedDesktopLayout pinnedTrack={pinnedTrack} others={others} onTogglePin={togglePin} />
    );
  }

  const count = cameraTracks.length;
  const localIdentity = localParticipant?.identity;

  /* ═════════════════════════════════════════════════════════════════
     MOBILE — Comportement Google Meet
     ═══════════════════════════════════════════════════════════════════ */
  if (isMobile) {
    if (count === 1) {
      return (
        <div className="flex h-full w-full items-center justify-center p-3">
          <div className="relative h-full w-full overflow-hidden rounded-2xl bg-meet-tile">
            <ParticipantTileWithSpeaking
              trackRef={cameraTracks[0]}
              isLocal={cameraTracks[0].participant.isLocal}
              className="h-full w-full"
            />
          </div>
        </div>
      );
    }

    if (count === 2) {
      const other =
        cameraTracks.find((t) => t.participant.identity !== localIdentity) || cameraTracks[0];
      const me = cameraTracks.find((t) => t.participant.identity === localIdentity);

      return (
        <div className="relative h-full w-full bg-black">
          <div className="h-full w-full">
            <ParticipantTileWithSpeaking
              trackRef={other}
              isLocal={other.participant.isLocal}
              onTogglePin={() => togglePin(other.participant.identity)}
              className="h-full w-full"
            />
          </div>

          {me && (
            <div className="absolute bottom-20 right-3 z-10 h-32 w-24 overflow-hidden rounded-2xl border border-white/10 shadow-2xl sm:h-36 sm:w-28">
              <ParticipantTileWithSpeaking trackRef={me} isLocal className="h-full w-full" />
            </div>
          )}
        </div>
      );
    }

    if (count <= 4) {
      return (
        <div className="flex h-full w-full flex-col gap-1.5 p-1.5">
          {cameraTracks.map((trackRef) => (
            <div
              key={trackRef.participant.identity}
              className="relative flex-1 overflow-hidden rounded-2xl bg-black"
            >
              <ParticipantTileWithSpeaking
                trackRef={trackRef}
                isLocal={trackRef.participant.isLocal}
                onTogglePin={() => togglePin(trackRef.participant.identity)}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      );
    }

    const [first, ...rest] = cameraTracks;

    return (
      <div className="flex h-full w-full flex-col gap-1.5 p-1.5">
        <div className="relative h-[55%] overflow-hidden rounded-2xl bg-black">
          <ParticipantTileWithSpeaking
            trackRef={first}
            isLocal={first.participant.isLocal}
            onTogglePin={() => togglePin(first.participant.identity)}
            className="h-full w-full"
          />
        </div>

        <div className="flex h-[45%] gap-2 overflow-x-auto overflow-y-hidden pb-1 snap-x snap-mandatory">
          {rest.map((trackRef) => (
            <div
              key={trackRef.participant.identity}
              className="h-full flex-shrink-0 snap-start overflow-hidden rounded-xl bg-black"
              style={{ aspectRatio: "3/4" }}
            >
              <ParticipantTileWithSpeaking
                trackRef={trackRef}
                isLocal={trackRef.participant.isLocal}
                onTogglePin={() => togglePin(trackRef.participant.identity)}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ═════════════════════════════════════════════════════════════════
     DESKTOP
     Disposition en lignes fixes : jusqu'à 6 tuiles par ligne, 3 lignes max (18 tuiles).
     Au-delà de 18, afficher un indicateur +N après les 18 premières tuiles.
     Les lignes sont remplies par paires lorsque le nombre est pair pour éviter
     un déséquilibre visuel.
     ══════════════════════════════════════════════════════════════════ */
  if (count === 1) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 sm:p-10">
        <div className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] bg-meet-tile shadow-2xl aspect-video">
          <ParticipantTileWithSpeaking
            trackRef={cameraTracks[0]}
            isLocal={cameraTracks[0].participant.isLocal}
            className="h-full w-full"
          />
        </div>
      </div>
    );
  }

  const { rows, tileSize, overflowCount } = getDesktopRows(count);
  let trackIndex = 0;

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden p-4 sm:p-6">
      <div className="flex flex-col gap-1 sm:gap-1.5">
        {rows.map((rowLength, rowIdx) => (
          <div key={rowIdx} className="flex gap-1 sm:gap-1.5">
            {Array.from({ length: rowLength }).map((_, cellIdx) => {
              const isLastCell =
                rowIdx === rows.length - 1 && cellIdx === rowLength - 1;

              if (isLastCell && overflowCount > 0) {
                // Overflow indicator cell
                return (
                  <div
                    key="overflow"
                    className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-meet-tile"
                    style={{ width: tileSize, height: tileSize }}
                  >
                    <span className="text-3xl font-semibold text-white sm:text-4xl">
                      +{overflowCount}
                    </span>
                  </div>
                );
              }

              const trackRef = cameraTracks[trackIndex];
              trackIndex += 1;
              return (
                <div
                  key={trackRef.participant.identity}
                  className="aspect-square overflow-hidden rounded-2xl"
                  style={{ width: tileSize, height: tileSize }}
                >
                  <ParticipantTileWithSpeaking
                    trackRef={trackRef}
                    isLocal={trackRef.participant.isLocal}
                    className={`
                      h-full w-full
                    `}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Détermine la disposition en lignes fixes + la taille des tuiles selon
 * le nombre de participants.
 * - Max 6 tuiles par ligne
 * - Max 3 lignes visibles (18 tuiles)
 * - Au-delà de 18, overflowCount indique le nombre de tuiles masquées
 * - Lorsqu'il est possible, les lignes sont remplies par paires (2,4,6) pour
 *   garder un équilibre visuel.
 */
function getDesktopRows(count: number): {
  rows: number[];
  tileSize: number;
  overflowCount: number;
} {
  const MAX_PER_ROW = 6;
  const MAX_ROWS = 3;
  const VISIBLE_LIMIT = MAX_PER_ROW * MAX_ROWS; // 18

  let overflowCount = 0;
  let visibleCount = Math.min(count, VISIBLE_LIMIT);
  if (count > VISIBLE_LIMIT) {
    overflowCount = count - VISIBLE_LIMIT;
  }

  // We want to fill rows with even numbers when possible.
  // Start by filling as many full rows of 6 as needed, then adjust.
  const fullRows = Math.floor(visibleCount / MAX_PER_ROW);
  const remainder = visibleCount % MAX_PER_ROW;
  let rows: number[] = Array(fullRows).fill(MAX_PER_ROW);

  if (remainder > 0) {
    // Try to make the last row even if possible by borrowing from previous row.
    if (rows.length > 0 && remainder % 2 !== 0) {
      // If remainder is odd, we take 1 from the last full row to make it even.
      rows[rows.length - 1] -= 1;
      rows.push(remainder + 1);
    } else {
      rows.push(remainder);
    }
  }

  // If we have no rows (count < 6) we still want at least one row.
  if (rows.length === 0 && visibleCount > 0) {
    rows = [visibleCount];
  }

  // Tile size mapping: larger counts get smaller tiles.
  // We keep a reasonable size down to 18, then fallback to 80px.
  const sizeByCount: Record<number, number> = {
    2: 280,
    3: 260,
    4: 240,
    5: 220,
    6: 200,
    7: 190,
    8: 180,
    9: 170,
    10: 160,
    11: 150,
    12: 140,
    13: 130,
    14: 120,
    15: 115,
    16: 110,
    17: 105,
    18: 100,
  };
  const tileSize = sizeByCount[visibleCount] ?? 80;

  return { rows, tileSize, overflowCount };
}

/* ════════════════════════════════════════════════════════════════
   Layouts Screen Share
   ═══════════════════════════════════════════════════════════════ */


/* ════════════════════════════════════════════════════════════════
   Layouts Épingle (spotlight) — même structure que le partage d'écran,
   mais avec le participant épinglé en grand et un bouton pour
   désépingler directement sur sa tuile.
   ════════════════════════════════════════════════════════════════ */

interface PinnedLayoutProps {
  pinnedTrack: ReturnType<typeof useTracks>[number];
  others: ReturnType<typeof useTracks>;
  onTogglePin: (identity: string) => void;
}

function PinnedDesktopLayout({ pinnedTrack, others, onTogglePin }: PinnedLayoutProps) {
  return (
    <div className="flex h-full w-full items-center justify-center gap-3 overflow-hidden p-4 sm:gap-4 sm:p-6">
      <div className="relative flex h-full flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black shadow-xl">
        <ParticipantTileWithSpeaking
          trackRef={pinnedTrack}
          isLocal={pinnedTrack.participant.isLocal}
          isPinned
          onTogglePin={() => onTogglePin(pinnedTrack.participant.identity)}
          className="h-full w-full"
        />
      </div>

      {others.length > 0 && (
        <div className="flex h-full w-28 flex-shrink-0 flex-col gap-2 overflow-y-auto sm:w-32">
          {others.map((trackRef) => (
            <div
              key={trackRef.participant.identity}
              className="aspect-video w-full flex-shrink-0 overflow-hidden rounded-xl"
            >
              <ParticipantTileWithSpeaking
                trackRef={trackRef}
                isLocal={trackRef.participant.isLocal}
                onTogglePin={() => onTogglePin(trackRef.participant.identity)}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PinnedMobileLayout({ pinnedTrack, others, onTogglePin }: PinnedLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-hidden p-2">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black">
        <ParticipantTileWithSpeaking
          trackRef={pinnedTrack}
          isLocal={pinnedTrack.participant.isLocal}
          isPinned
          onTogglePin={() => onTogglePin(pinnedTrack.participant.identity)}
          className="h-full w-full"
        />
      </div>

      {others.length > 0 && (
        <div className="flex h-16 flex-shrink-0 gap-2 overflow-x-auto">
          {others.map((trackRef) => (
            <div
              key={trackRef.participant.identity}
              className="aspect-video h-full flex-shrink-0 overflow-hidden rounded-lg"
            >
              <ParticipantTileWithSpeaking
                trackRef={trackRef}
                isLocal={trackRef.participant.isLocal}
                onTogglePin={() => onTogglePin(trackRef.participant.identity)}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}